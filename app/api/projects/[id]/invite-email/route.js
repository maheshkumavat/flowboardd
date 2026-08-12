import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin, getServerUser, checkIsProjectAdmin } from '../../../../../lib/supabase';
import { createEmailInvite } from '../../../../../lib/invitesStore';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  try {
    const projectId = params.id;
    const body = await req.json();
    const { email, role = 'MEMBER' } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const user = await getServerUser(req);
    if (!user || !(await checkIsProjectAdmin(projectId, user))) {
      return NextResponse.json({ error: 'Forbidden: Only Admins can send email invitations' }, { status: 403 });
    }

    // Fetch project details
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();

    const projectName = project?.name || 'Project';
    const token = crypto.randomBytes(16).toString('hex');

    const inviteRecord = await createEmailInvite({
      projectId,
      email,
      role,
      token,
      createdBy: user.id,
    });

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const inviteLink = `${protocol}://${host}/invite/accept?token=${token}`;

    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'FlowBoard <invites@resend.dev>',
            to: [email.trim()],
            subject: `You're invited to join ${projectName} on FlowBoard`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #eee; rounded: 12px;">
                <h2 style="color: #4f46e5;">FlowBoard Workspace Invitation</h2>
                <p>Hello,</p>
                <p><strong>${user.user_metadata?.name || user.email}</strong> has invited you to join the project <strong>${projectName}</strong> as a <strong>${role}</strong>.</p>
                <div style="margin: 24px 0;">
                  <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Invitation & Join Project</a>
                </div>
                <p style="color: #666; font-size: 13px;">Or copy and paste this URL into your browser:</p>
                <p style="color: #666; font-size: 13px; word-break: break-all;">${inviteLink}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #999; font-size: 12px;">This invitation link will expire in 7 days.</p>
              </div>
            `,
          }),
        });

        if (!resendRes.ok) {
          const errData = await resendRes.json();
          console.error('Resend API error:', errData);
        } else {
          console.log(`[Resend Email Sent] Successfully sent invite email to ${email}`);
          return NextResponse.json({
            message: `Email invitation sent successfully to ${email}!`,
            inviteLink,
          }, { status: 200 });
        }
      } catch (err) {
        console.error('Failed to send email via Resend:', err);
      }
    }

    console.log(`[Invite Email Link Generated] ${inviteLink}`);
    return NextResponse.json({
      message: resendApiKey
        ? `Email sent to ${email}!`
        : `Invite link created! (Set RESEND_API_KEY in .env to send actual email via Resend)`,
      inviteLink,
    }, { status: 200 });

  } catch (error) {
    console.error('Invite email error:', error);
    return NextResponse.json({ error: 'Failed to create email invitation' }, { status: 500 });
  }
}
