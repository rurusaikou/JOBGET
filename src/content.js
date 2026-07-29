(function () {
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

  function cleanText(value) {
    return normalizeMaskedDigits(value)
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function normalizeMaskedDigits(value) {
    return String(value || "").replace(/[\ue030-\ue03a]/g, (char) => MASKED_DIGIT_MAP[char] || char);
  }

  function textOf(node) {
    return cleanText(node && node.innerText);
  }

  function firstText(selectors, root) {
    const scope = root || document;

    for (const selector of selectors) {
      const text = textOf(scope.querySelector(selector));
      if (text) return text;
    }

    return "";
  }

  function findSalaryByPattern(text) {
    const matches = cleanText(text).match(/\b\d+(?:\.\d+)?\s*[-~到]\s*\d+(?:\.\d+)?\s*[Kk千万][^,\n，。；; ]{0,8}|\b\d+(?:\.\d+)?\s*[Kk千万][^,\n，。；; ]{0,8}/g);
    return matches ? cleanText(matches[0]) : "";
  }

  function findExperienceByPattern(text) {
    const match = cleanText(text).match(EXPERIENCE_PATTERN);
    return match ? cleanText(match[0]) : "";
  }

  function findEducationByPattern(text) {
    const match = cleanText(text).match(EDUCATION_PATTERN);
    return match ? cleanText(match[0]) : "";
  }

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

    const detailBox = document.querySelector(".job-detail-container .job-detail-box");
    if (!detailBox) return null;

    const salary = findSalaryByPattern(firstText([
      ".job-detail-header .job-detail-info .job-salary"
    ], detailBox));
    const title = cleanTitle(firstText([
      ".job-detail-header .job-detail-info .job-name"
    ], detailBox), salary);
    const tags = Array.from(detailBox.querySelectorAll(".job-detail-header .tag-list li"))
      .map((node) => cleanText(node.innerText))
      .filter(Boolean);
    const description = textOf(detailBox.querySelector(".job-detail-body > p.desc"));
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
    const link = detailBox.querySelector(".job-detail-body a.more-job-btn[href*='/job_detail/']");
    const href = link && link.getAttribute("href");
    const match = String(href || "").match(/\/job_detail\/([^.?/]+)/);
    return match ? match[1] : "";
  }

  function findZhipinCompanyByJobId(jobId) {
    if (!jobId) return "";

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

    if (!text || invalid.includes(text)) return "";
    if (findSalaryByPattern(text) || findExperienceByPattern(text) || findEducationByPattern(text)) return "";
    if (/招聘专家|招聘经理|猎头顾问|HR|人事|在线|活跃/.test(text)) return "";

    return text;
  }

  function extractGenericJob(jsonLd) {
    const normalized = normalizeJsonLdJob(jsonLd);
    if (normalized && (normalized.title || normalized.description)) return normalized;

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
    return {
      tag: node.tagName.toLowerCase(),
      selector: cssPath(node),
      attrs: pickAttrs(node),
      text: cleanText(node.innerText || node.textContent).slice(0, 300)
    };
  }

  function pickAttrs(node) {
    const attrs = {};
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
        part += `#${current.id}`;
        parts.unshift(part);
        break;
      }

      const classes = Array.from(current.classList || []).slice(0, 3);
      if (classes.length) part += `.${classes.join(".")}`;

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((item) => item.tagName === current.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }

      parts.unshift(part);
      current = parent;
    }

    return ["body", ...parts].join(" > ");
  }

  function buildDomOutline(node, depth, state) {
    if (!node || state.count >= state.max || depth > state.maxDepth) return null;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const style = window.getComputedStyle(node);
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
    return cleanText(Array.from(node.childNodes)
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent)
      .join(" "));
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === "JDGET_EXTRACT") {
      sendResponse({ ok: true, job: extractJob() });
    }

    if (message && message.type === "JDGET_INSPECT_DOM") {
      sendResponse({ ok: true, report: buildDomReport() });
    }
  });
})();
