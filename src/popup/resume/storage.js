import { RESUME_KEY } from "../constants.js";
import { getLocal, setLocal } from "../storage.js";

export async function getResume() {
  const data = await getLocal({ [RESUME_KEY]: null });
  return data[RESUME_KEY] || null;
}

export async function setResume(resume) {
  await setLocal({ [RESUME_KEY]: resume });
  return resume;
}

export async function clearResume() {
  await setLocal({ [RESUME_KEY]: null });
  return null;
}
