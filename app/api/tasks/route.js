import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser } from '../../../lib/supabase';
import { evaluateTaskRisk } from '../../../lib/ai/riskEvaluator';
import { logActivity } from '../../../lib/activityLogger';

export async function POST(req) {
  try {
    const body = await req.json();

    const currentUser = await getServerUser(req);
    const currentUserId = currentUser?.id;

    if (body.batch && Array.isArray(body.tasks)) {
      const { projectId, columnId, tasks } = body;
      if (!projectId || !columnId || tasks.length === 0) {
        return NextResponse.json({ error: 'Missing projectId, columnId, or tasks array' }, { status: 400 });
      }

      const createdTasks = [];
      for (let i = 0; i < tasks.length; i++) {
        const item = tasks[i];
        let dueDateObj = item.dueDate || null;
        if (!dueDateObj && item.estimatedDays) {
          const d = new Date();
          d.setDate(d.getDate() + parseInt(item.estimatedDays));
          dueDateObj = d.toISOString();
        }

        const taskData = {
          project_id: projectId,
          column_id: columnId,
          title: item.title,
          description: item.description || '',
          required_skill: item.requiredSkill || null,
          priority: item.priority || 'MEDIUM',
          due_date: dueDateObj,
          assignee_id: item.assigneeId || null,
          position: i,
        };

        const risk = evaluateTaskRisk({ ...taskData, dueDate: taskData.due_date, requiredSkill: taskData.required_skill });
        taskData.risk_flag = risk.isAtRisk;

        const { data: newTask } = await supabaseAdmin
          .from('tasks')
          .insert(taskData)
          .select()
          .single();

        if (currentUserId) {
          await logActivity({
            projectId,
            userId: currentUserId,
            action: 'task_created',
            metadata: { taskTitle: item.title, isAi: true },
          });
        }

        createdTasks.push({
          id: newTask ? newTask.id : `t-ai-${Date.now()}-${i}`,
          projectId,
          columnId,
          title: item.title,
          description: item.description || '',
          requiredSkill: item.requiredSkill || null,
          priority: item.priority || 'MEDIUM',
          dueDate: dueDateObj,
          riskFlag: risk.isAtRisk,
          riskReason: risk.riskReason,
          comments: [],
        });
      }

      return NextResponse.json({ tasks: createdTasks }, { status: 201 });
    }

    // Single task creation
    const { projectId, columnId, title, description, assigneeId, dueDate, priority, requiredSkill } = body;

    if (!projectId || !columnId || !title) {
      return NextResponse.json({ error: 'Project ID, column ID, and title are required' }, { status: 400 });
    }

    const taskData = {
      project_id: projectId,
      column_id: columnId,
      title: title.trim(),
      description: description ? description.trim() : null,
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
      priority: priority || 'MEDIUM',
      required_skill: requiredSkill ? requiredSkill.trim() : null,
      position: 0,
    };

    const riskEval = evaluateTaskRisk({ ...taskData, dueDate: taskData.due_date, requiredSkill: taskData.required_skill });
    taskData.risk_flag = riskEval.isAtRisk;

    const { data: task } = await supabaseAdmin
      .from('tasks')
      .insert(taskData)
      .select(`
        *,
        assignee:profiles!assignee_id(id, name, email, github_username)
      `)
      .single();

    if (currentUserId) {
      await logActivity({
        projectId,
        userId: currentUserId,
        action: 'task_created',
        metadata: { taskTitle: title.trim() },
      });
    }

    return NextResponse.json({
      task: {
        id: task ? task.id : `t-${Date.now()}`,
        projectId: task ? task.project_id : projectId,
        columnId: task ? task.column_id : columnId,
        title: task ? task.title : title.trim(),
        description: task ? task.description : (description || ''),
        assigneeId: task ? task.assignee_id : (assigneeId || null),
        assignee: task?.assignee ? { id: task.assignee.id, name: task.assignee.name, email: task.assignee.email } : null,
        dueDate: task ? task.due_date : (dueDate || null),
        priority: task ? task.priority : (priority || 'MEDIUM'),
        requiredSkill: task ? task.required_skill : (requiredSkill || null),
        riskFlag: riskEval.isAtRisk,
        riskReason: riskEval.riskReason,
        comments: [],
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Task creation error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
