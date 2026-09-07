// 同一任务、同一岗位只接受最新请求；切换页面不会取消原岗位的保存资格。
export function createRequestRegistry() {
  const requests = new Map();
  const slot = (task, jobId) => `${task}:${jobId}`;
  return {
    start(task, jobId, key) {
      const ticket = { task, jobId, key, loading: true, error: "" };
      requests.set(slot(task, jobId), ticket);
      return ticket;
    },
    isCurrent(ticket) {
      return requests.get(slot(ticket.task, ticket.jobId)) === ticket;
    },
    get(task, jobId, key) {
      const ticket = requests.get(slot(task, jobId));
      return ticket?.key === key ? ticket : null;
    },
    finish(ticket, error = "") {
      if (this.isCurrent(ticket)) Object.assign(ticket, { loading: false, error });
    },
    invalidate(task, jobId) {
      for (const [key, ticket] of requests) {
        if ((!task || ticket.task === task) && (!jobId || ticket.jobId === jobId)) requests.delete(key);
      }
    }
  };
}
