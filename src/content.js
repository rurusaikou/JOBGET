(function () {
  // content script 运行在招聘网站页面里，负责读取真实 DOM。
  // 侧边栏面板不直接访问页面 DOM，而是通过 chrome.tabs.sendMessage 调用这里的能力。

  // BOSS 直聘会用私有 Unicode 字符渲染薪资数字。
  // 这里把当前已验证的一组字符还原为普通数字，保证 Excel 中能看到真实薪资。
  const MASKED_DIGIT_MAP = {
    "\ue030": "0",
    "\ue031": "0",
    "\ue032": "1",
    "\ue033": "2",
    "\ue034": "3",
    "\ue035": "4",
    "\ue036": "5",
    "\ue037": "6",
    "\ue038": "7",
    "\ue039": "8",
    "\ue03a": "9"
  };

  const EXPERIENCE_PATTERN = /(经验不限|在校\/应届|应届生?|无经验|\d+\s*年以内|\d+\s*-\s*\d+\s*年|\d+\s*年以上|1年以下|1-3年|3-5年|5-10年|10年以上)/;
  const EDUCATION_PATTERN = /(学历不限|中专\/中技|高中|大专|本科|硕士|博士|MBA|EMBA)/i;

  // 统一的职位数据结构。
  // 这样每个提取器都返回同一组字段，侧边栏面板导出 Excel 时不用关心来源站点。
  // 当前 Excel 只需要这些字段。其他调试信息放在 DOM 报告里，不进入导出数据。
  const EMPTY_JOB = {
    title: "",
    company: "",
    location: "",
    experience: "",
    education: "",
    salary: "",
    description: "",
    postedDate: "",
    sourceUrl: ""
  };

  // 页面文本会带有 nbsp、多余换行、连续空格，以及 BOSS 的遮盖数字。
  // 所有字段在进入存储和导出前都走这里，减少各提取器重复清洗。
  function cleanText(value) {
    return normalizeMaskedDigits(value)
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  // BOSS 的薪资数字不是普通 0-9，而是 E030-E03A 私有字符。
  // 映射在文本清洗最前面执行，后续薪资正则才能正常识别。
  function normalizeMaskedDigits(value) {
    return String(value || "").replace(/[\ue030-\ue03a]/g, (char) => MASKED_DIGIT_MAP[char] || char);
  }

  // DOM 节点文本读取的安全包装：允许传入 null，并统一走 cleanText。
  // 对页面 selector 改动很频繁的场景，这能减少空节点运行时报错。
  function textOf(node) {
    return cleanText(node && node.innerText);
  }

  // 按顺序尝试多个 selector，返回第一个非空文本。
  // 通用兜底解析会用这个函数；BOSS 专用解析尽量使用更精确的结构节点。
  function firstText(selectors, root) {
    const scope = root || document;

    for (const selector of selectors) {
      const text = textOf(scope.querySelector(selector));
      if (text) return text;
    }

    return "";
  }

  // 从任意文本里抠出薪资短字段，例如 25-30K、40-70K·20薪。
  // 这个函数既用于字段提取，也用于过滤误识别的公司名/标题。
  function findSalaryByPattern(text) {
    const matches = cleanText(text).match(/\b\d+(?:\.\d+)?\s*[-~到]\s*\d+(?:\.\d+)?\s*[Kk千万][^,\n，。；; ]{0,8}|\b\d+(?:\.\d+)?\s*[Kk千万][^,\n，。；; ]{0,8}/g);
    return matches ? cleanText(matches[0]) : "";
  }

  // 经验和学历有时在独立标签里，有时只存在整页文本中。
  // BOSS 专用路径优先取 tag-list，通用路径再用这两个正则兜底。
  function findExperienceByPattern(text) {
    const match = cleanText(text).match(EXPERIENCE_PATTERN);
    return match ? cleanText(match[0]) : "";
  }

  function findEducationByPattern(text) {
    const match = cleanText(text).match(EDUCATION_PATTERN);
    return match ? cleanText(match[0]) : "";
  }

  // 一些页面会把标题和薪资放在同一个容器甚至同一段文本里。
  // 导出岗位名称前要剔除薪资行，避免出现“产品经理\n25-30K”。
  function cleanTitle(title, salary) {
    const salaryText = cleanText(salary);
    return cleanText(title)
      .split("\n")
      .map((line) => cleanText(line.replace(salaryText, "")))
      .filter((line) => line && !findSalaryByPattern(line))
      .join("\n");
  }

  // 优先解析页面中的 JobPosting JSON-LD。很多招聘网站会提供这类结构化数据；
  // BOSS 当前列表详情页不稳定，所以 JSON-LD 只作为通用兜底。
  function findJsonLdJob() {
    const scripts = Array.from(document.querySelectorAll("script[type='application/ld+json']"));

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || "{}");
        const nodes = Array.isArray(data) ? data : [data];
        const flattened = nodes.flatMap((node) => Array.isArray(node["@graph"]) ? node["@graph"] : [node]);
        const job = flattened.find((node) => {
          const type = node && node["@type"];
          return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
        });

        if (job) return job;
      } catch (_error) {
        // 页面中的 JSON-LD 可能被压缩或注入为非标准 JSON；失败时继续尝试 DOM。
      }
    }

    return null;
  }

  function normalizeJsonLdJob(job) {
    if (!job) return null;

    // JSON-LD 的 jobLocation/baseSalary 在不同站点上结构不完全一致。
    // 这里只处理最常见的 JobPosting 形态，复杂站点仍然需要站点专用解析器。
    const jobLocation = Array.isArray(job.jobLocation) ? job.jobLocation[0] : job.jobLocation;
    const address = jobLocation && jobLocation.address;
    const salaryValue = job.baseSalary && job.baseSalary.value;
    const salary = salaryValue
      ? [salaryValue.minValue, salaryValue.maxValue, salaryValue.unitText].filter(Boolean).join(" ")
      : "";

    return {
      ...EMPTY_JOB,
      title: cleanText(job.title),
      company: cleanText(job.hiringOrganization && job.hiringOrganization.name),
      location: cleanText([
        address && address.addressLocality,
        address && address.addressRegion,
        address && address.addressCountry
      ].filter(Boolean).join(", ")),
      salary: cleanText(salary || job.baseSalary),
      description: cleanText(stripHtml(job.description)),
      postedDate: cleanText(job.datePosted),
      sourceUrl: location.href
    };
  }

  function stripHtml(value) {
    const template = document.createElement("template");
    template.innerHTML = String(value || "");
    return template.content.textContent || "";
  }

  // BOSS 搜索列表右侧详情页的稳定结构来自实际导出的 fullHtml：
  // - 详情卡片：.job-detail-container .job-detail-box
  // - 标题/薪资：.job-detail-header .job-detail-info
  // - 地点/经验/学历：.job-detail-header .tag-list li
  // - JD 正文：.job-detail-body > p.desc
  // - 公司名：右侧详情没有独立公司字段，需要用当前 jobId 回到左侧职位卡片取 .boss-name
  function extractZhipinJob() {
    if (!/zhipin\.com/i.test(location.hostname)) return null;

    // BOSS 搜索页右侧详情面板加载完成后会出现这个容器。
    // 如果用户还停留在列表加载态，或者页面结构换了，这里返回 null 交给通用兜底。
    const detailBox = document.querySelector(".job-detail-container .job-detail-box");
    if (!detailBox) return null;

    // 右侧详情头部只包含当前选中职位，不会混入左侧列表的其他岗位。
    const salary = findSalaryByPattern(firstText([
      ".job-detail-header .job-detail-info .job-salary"
    ], detailBox));
    const title = cleanTitle(firstText([
      ".job-detail-header .job-detail-info .job-name"
    ], detailBox), salary);
    const tags = Array.from(detailBox.querySelectorAll(".job-detail-header .tag-list li"))
      .map((node) => cleanText(node.innerText))
      .filter(Boolean);

    // BOSS 正文实际落在 p.desc 里，后面的 .job-boss-info 和 .job-address
    // 是同级后续模块，所以这里直接取 p.desc，不再从 job-detail-body 整块取文本。
    const description = textOf(detailBox.querySelector(".job-detail-body > p.desc"));

    // 右侧详情没有稳定的公司字段。more-job-btn 的 href 带有当前职位 jobId，
    // 再用这个 jobId 回到左侧对应职位卡片，才能取到同一职位的公司名。
    const jobId = findZhipinDetailJobId(detailBox);

    return {
      ...EMPTY_JOB,
      title,
      company: findZhipinCompanyByJobId(jobId),
      location: tags[0] || "",
      experience: tags[1] || findExperienceByPattern(tags.join("\n")),
      education: tags[2] || findEducationByPattern(tags.join("\n")),
      salary,
      description,
      sourceUrl: location.href
    };
  }

  function findZhipinDetailJobId(detailBox) {
    // BOSS 右侧详情底部“查看更多信息”链接包含 /job_detail/{jobId}.html。
    // 这个 id 与左侧列表卡片里的职位链接一致，是左右区域建立关系的关键。
    const link = detailBox.querySelector(".job-detail-body a.more-job-btn[href*='/job_detail/']");
    const href = link && link.getAttribute("href");
    const match = String(href || "").match(/\/job_detail\/([^.?/]+)/);
    return match ? match[1] : "";
  }

  function findZhipinCompanyByJobId(jobId) {
    if (!jobId) return "";

    // 左侧列表中每个职位卡片都有 a.job-name。先通过 jobId 找到当前选中的卡片，
    // 再从卡片 footer 的 .boss-name 读取公司简称。避免误取右侧 Boss 姓名/职位。
    const jobLink = Array.from(document.querySelectorAll(".job-card-box a.job-name[href*='/job_detail/']")).find((node) => {
      return String(node.getAttribute("href") || "").includes(`/job_detail/${jobId}`);
    });
    const card = jobLink && jobLink.closest(".job-card-box");
    const companyNode = card && card.querySelector(".job-card-footer .boss-name");

    return cleanCompanyName(textOf(companyNode));
  }

  function cleanCompanyName(value) {
    const text = cleanText(value);
    const invalid = ["公司", "公司名称", "企业", "企业名称", "公司介绍", "工商信息"];

    // 公司名提取宁可为空，也不要把字段标题、薪资、经验学历或 HR 信息写进 Excel。
    if (!text || invalid.includes(text)) return "";
    if (findSalaryByPattern(text) || findExperienceByPattern(text) || findEducationByPattern(text)) return "";
    if (/招聘专家|招聘经理|猎头顾问|HR|人事|在线|活跃/.test(text)) return "";

    return text;
  }

  function extractGenericJob(jsonLd) {
    // 非 BOSS 页面先吃标准 JobPosting。很多招聘站点会把字段放在 JSON-LD 中，
    // 这比 DOM selector 更稳定，也不会受页面布局变化影响。
    const normalized = normalizeJsonLdJob(jsonLd);
    if (normalized && (normalized.title || normalized.description)) return normalized;

    // 没有 JSON-LD 时才进入通用 DOM 兜底。这里不追求覆盖所有网站，
    // 只保证在常见命名下能拿到一版基础数据，后续站点应增加专用提取器。
    const pageText = textOf(document.body);
    const salary = findSalaryByPattern(pageText);

    return {
      ...EMPTY_JOB,
      title: cleanTitle(firstText([
        "[data-testid*='job-title' i]",
        "[class*='job-title' i]",
        "[class*='position-title' i]",
        "h1"
      ]), salary || ""),
      company: firstText([
        "[data-testid*='company-name' i]",
        "[class*='company-name' i]",
        "[class*='employer-name' i]",
        "[class*='brand-name' i]"
      ]),
      location: firstText([
        "[data-testid*='location' i]",
        "[class*='location' i]",
        "[class*='address' i]"
      ]),
      experience: findExperienceByPattern(pageText),
      education: findEducationByPattern(pageText),
      salary,
      description: firstText([
        "[data-testid*='description' i]",
        "[class*='job-description' i]",
        "[class*='job-detail' i]",
        "article",
        "main"
      ]),
      sourceUrl: location.href
    };
  }

  function extractJob() {
    const jsonLd = findJsonLdJob();

    // 提取优先级：
    // 1. BOSS 专用结构：目前验证最充分，字段准确率最高。
    // 2. JSON-LD/通用 DOM：用于其他招聘网站或 BOSS 结构变化时的兜底。
    return extractZhipinJob() || extractGenericJob(jsonLd);
  }

  // DOM 报告用于后续适配新站点或核对 BOSS 页面结构。它会包含完整 HTML，
  // 以及一份较轻的可读 DOM 轮廓，方便快速定位字段节点。
  function buildDomReport() {
    const fullHtml = document.documentElement.outerHTML;

    return {
      url: location.href,
      host: location.hostname,
      title: document.title,
      capturedAt: new Date().toISOString(),
      fullHtmlLength: fullHtml.length,
      fullHtml,
      extracted: extractJob(),
      // candidates 是给人看的定位辅助，不参与业务提取。
      // 当字段异常时，先看这里的候选节点，再决定是否新增/调整 selector。
      candidates: {
        title: candidateNodes([".job-detail-info .job-name", ".job-name", "h1"]),
        company: candidateNodes([".job-card-footer .boss-name", ".company-name", "[class*='company-name' i]"]),
        meta: candidateNodes([".job-detail-header .tag-list", ".tag-list"]),
        salary: candidateNodes([".job-detail-info .job-salary", ".job-salary", "[class*='salary' i]"]),
        description: candidateNodes([".job-detail-body > p.desc", ".job-sec-text", ".job-description"])
      },
      outline: buildDomOutline(document.body, 0, { count: 0, max: 1600, maxDepth: 9 })
    };
  }

  function candidateNodes(selectors, root) {
    const scope = root || document;
    const seen = new Set();
    const candidates = [];

    for (const selector of selectors) {
      // 每个 selector 最多保留 20 个节点，避免报告被列表页大量重复卡片撑爆。
      for (const node of Array.from(scope.querySelectorAll(selector)).slice(0, 20)) {
        if (seen.has(node)) continue;
        seen.add(node);
        candidates.push({
          matchedSelector: selector,
          ...describeNode(node)
        });
      }
    }

    return candidates.slice(0, 40);
  }

  function describeNode(node) {
    // 单个候选节点只保留可读定位信息：标签、稳定属性、CSS 路径、短文本。
    // 完整 HTML 已经放在 fullHtml，这里不重复塞大段源码。
    return {
      tag: node.tagName.toLowerCase(),
      selector: cssPath(node),
      attrs: pickAttrs(node),
      text: cleanText(node.innerText || node.textContent).slice(0, 300)
    };
  }

  function pickAttrs(node) {
    const attrs = {};
    // 这些属性通常最有助于定位前端组件；style/src/href 体积大且噪声多，不放入 outline。
    ["id", "class", "data-testid", "ka", "role", "aria-label"].forEach((name) => {
      const value = node.getAttribute && node.getAttribute(name);
      if (value) attrs[name] = value;
    });
    return attrs;
  }

  function cssPath(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return "";

    const parts = [];
    let current = node;

    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        // id 通常足够唯一，遇到 id 后停止向上追溯，路径更短也更稳定。
        part += `#${current.id}`;
        parts.unshift(part);
        break;
      }

      const classes = Array.from(current.classList || []).slice(0, 3);
      if (classes.length) part += `.${classes.join(".")}`;

      const parent = current.parentElement;
      if (parent) {
        // 同级存在多个相同标签时加 nth-of-type，方便从报告回到具体节点。
        const siblings = Array.from(parent.children).filter((item) => item.tagName === current.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }

      parts.unshift(part);
      current = parent;
    }

    return ["body", ...parts].join(" > ");
  }

  function buildDomOutline(node, depth, state) {
    // outline 是 fullHtml 的轻量索引。限制节点数和深度，避免列表页/页面浮层 DOM 太大。
    if (!node || state.count >= state.max || depth > state.maxDepth) return null;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const style = window.getComputedStyle(node);
    // 隐藏浮层、二维码、上传框等会污染结构报告；outline 里直接跳过不可见节点。
    if (style.display === "none" || style.visibility === "hidden") return null;

    state.count += 1;

    const children = [];
    for (const child of Array.from(node.children)) {
      const childOutline = buildDomOutline(child, depth + 1, state);
      if (childOutline) children.push(childOutline);
      if (state.count >= state.max) break;
    }

    const outline = {
      tag: node.tagName.toLowerCase(),
      selector: cssPath(node),
      attrs: pickAttrs(node)
    };
    const text = directText(node);

    if (text) outline.text = text.slice(0, 160);
    if (children.length) outline.children = children;

    return outline;
  }

  function directText(node) {
    // 只取直接文本节点，不取子孙文本。
    // 这样 outline 每一层都只展示属于自己的标题/短标签，不会整块重复正文。
    return cleanText(Array.from(node.childNodes)
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent)
      .join(" "));
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // 侧边栏面板通过消息调用页面提取。这里同步返回即可，因为所有读取都来自当前 DOM。
    if (message && message.type === "JDGET_EXTRACT") {
      sendResponse({ ok: true, job: extractJob() });
    }

    // DOM 报告用于人工排查，不会写入本地 JD 列表。
    if (message && message.type === "JDGET_INSPECT_DOM") {
      sendResponse({ ok: true, report: buildDomReport() });
    }
  });
})();
