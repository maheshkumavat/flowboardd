/**
 * Isolated AI Feature #3: Automated Deadline Risk Evaluator
 */

/**
 * Evaluates whether a task should be flagged as "At Risk" based on deadlines & column progress.
 * Returns { isAtRisk: boolean, riskReason: string | null }
 */
function evaluateTaskRisk(task) {
  if (!task) return { isAtRisk: false, riskReason: null };

  const isDone = (task.status || '').toLowerCase() === 'done' || (task.column && task.column.name.toLowerCase() === 'done');
  if (isDone) {
    return { isAtRisk: false, riskReason: null };
  }

  const now = new Date().getTime();
  const dueDate = task.dueDate ? new Date(task.dueDate).getTime() : null;
  const createdAt = task.createdAt ? new Date(task.createdAt).getTime() : now;

  if (!dueDate) {
    return { isAtRisk: false, riskReason: null };
  }

  // 1. Overdue Condition
  if (now > dueDate) {
    const overdueHours = Math.round((now - dueDate) / (1000 * 60 * 60));
    return {
      isAtRisk: true,
      riskReason: `Overdue by ${overdueHours} hour${overdueHours === 1 ? '' : 's'}`,
    };
  }

  const hoursRemaining = (dueDate - now) / (1000 * 60 * 60);

  // 2. Imminent Deadline & Incomplete (Due within 48h and still "To Do")
  const isToDo = (task.status || '').toLowerCase() === 'to do' || (task.column && task.column.name.toLowerCase() === 'to do');
  if (hoursRemaining <= 48 && isToDo) {
    return {
      isAtRisk: true,
      riskReason: `Due in ${Math.max(1, Math.round(hoursRemaining))}h but still in To Do`,
    };
  }

  // 3. Timeline Progress Ratio (>50% elapsed timeline but no status progress)
  const totalDuration = dueDate - createdAt;
  if (totalDuration > 0) {
    const elapsedDuration = now - createdAt;
    const progressRatio = elapsedDuration / totalDuration;
    if (progressRatio > 0.50 && isToDo) {
      const percentage = Math.round(progressRatio * 100);
      return {
        isAtRisk: true,
        riskReason: `${percentage}% of timeline elapsed with 0 progress`,
      };
    }
  }

  return { isAtRisk: false, riskReason: null };
}

/**
 * Enriches tasks array with live calculated risk evaluation
 */
function enrichTasksWithRisk(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.map(task => {
    const riskEval = evaluateTaskRisk(task);
    return {
      ...task,
      riskFlag: riskEval.isAtRisk,
      riskReason: riskEval.riskReason,
    };
  });
}

module.exports = {
  evaluateTaskRisk,
  enrichTasksWithRisk,
};
