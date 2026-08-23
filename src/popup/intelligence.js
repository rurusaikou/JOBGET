import { JOB_KEYWORDS } from "./data/job-keywords.js";

export function keywordsFor(job) {
  const text = `${job.title} ${job.description}`.toLowerCase();
  const sourceText = jobSearchTextWithoutKeywords(job);
  const hits = JOB_KEYWORDS.filter((keyword) => text.includes(keyword.toLowerCase()) || sourceText.includes(keyword));
  return hits.length ? hits : [job.sourceSite, job.experience, job.education].filter(Boolean).slice(0, 4);
}

function jobSearchTextWithoutKeywords(job) {
  return [job.title, job.company, job.location, job.salary, job.experience, job.education, job.description].join(" ");
}
