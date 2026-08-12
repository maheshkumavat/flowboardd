import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser, ensureProfile } from '../../../../lib/supabase';
import { fetchGitHubData, generateSkillProfile } from '../../../../lib/ai/githubSkillMatcher';

export const dynamic = 'force-dynamic';

function isSkillProfileEmpty(prof) {
  if (!prof || typeof prof !== 'object') return true;
  const keys = Object.keys(prof);
  if (keys.length === 0) return true;

  let hasAnySkill = false;
  Object.values(prof).forEach((val) => {
    if (typeof val === 'object' && val !== null) {
      if (Object.keys(val).length > 0) {
        hasAnySkill = true;
      }
    } else if (val) {
      hasAnySkill = true;
    }
  });

  return !hasAnySkill;
}

export async function GET(req) {
  try {
    const user = await getServerUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let fullUser = user;
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(user.id);
      if (authData?.user) {
        fullUser = authData.user;
      }
    } catch (authErr) {}

    let profile = await ensureProfile(fullUser);
    const ghIdentity = fullUser.identities?.find((id) => id.provider === 'github');
    const ghFromIdentity = ghIdentity?.identity_data?.user_name || ghIdentity?.identity_data?.preferred_username;
    const ghUsername = profile?.github_username || fullUser.user_metadata?.github_username || fullUser.user_metadata?.user_name || fullUser.user_metadata?.preferred_username || ghFromIdentity || null;

    if (ghUsername && !profile?.github_username) {
      try {
        await supabaseAdmin
          .from('profiles')
          .update({ github_username: ghUsername })
          .eq('id', fullUser.id);
        if (profile) profile.github_username = ghUsername;
      } catch (e) {
        console.warn('DB update github_username warning:', e.message);
      }
    }

    let skillProf = profile?.skill_profile || {};

    // Auto-generate skill profile if GitHub username is present but skill_profile is empty or contains empty category shells
    if (ghUsername && isSkillProfileEmpty(skillProf)) {
      try {
        console.log(`[/api/auth/me] Auto-generating skill profile for connected GitHub user @${ghUsername}...`);
        const ghData = await fetchGitHubData(ghUsername);
        const generated = await generateSkillProfile(ghData);
        if (generated && Object.keys(generated).length > 0) {
          skillProf = generated;
          await supabaseAdmin
            .from('profiles')
            .update({
              github_username: ghUsername,
              skill_profile: generated,
            })
            .eq('id', fullUser.id);
          console.log(`[/api/auth/me] Skill profile successfully generated & saved for user ${fullUser.id}`);
        }
      } catch (err) {
        console.warn('[/api/auth/me] Skill profile auto-generation warning:', err.message);
      }
    }

    const primaryRole = profile?.primary_role ||
      (profile?.role && !['ADMIN', 'MEMBER', 'VIEWER'].includes(profile.role) ? profile.role : null) ||
      user.user_metadata?.primary_role ||
      skillProf?.primaryRole ||
      'Other';

    return NextResponse.json({
      user: {
        id: fullUser.id,
        email: fullUser.email,
        name: profile?.name || fullUser.user_metadata?.name || fullUser.user_metadata?.full_name || fullUser.email?.split('@')[0] || 'User',
        primaryRole: primaryRole,
        githubUsername: ghUsername,
        skillProfile: skillProf,
        avatarUrl: profile?.avatar_url || fullUser.user_metadata?.avatar_url || fullUser.user_metadata?.picture || null,
        notificationPreferences: fullUser.user_metadata?.notification_preferences || profile?.notification_preferences || {
          taskAssigned: true,
          joinRequests: true,
          comments: true,
        },
        appMetadata: fullUser.app_metadata || {},
        identities: fullUser.identities || [],
      },
    });
  } catch (error) {
    console.error('Auth /api/auth/me GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch current user' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const updatePayload = {};

    if (body.name !== undefined) updatePayload.name = body.name.trim();
    if (body.avatarUrl !== undefined) updatePayload.avatar_url = body.avatarUrl;
    if (body.primaryRole !== undefined) {
      updatePayload.primary_role = body.primaryRole.trim();
      updatePayload.role = body.primaryRole.trim();
    }
    
    if (body.skillProfile !== undefined || body.skill_profile !== undefined) {
      updatePayload.skill_profile = body.skillProfile || body.skill_profile;
    }

    if (body.syncGithubSkills) {
      let fullUser = user;
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(user.id);
        if (authData?.user) fullUser = authData.user;
      } catch (authErr) {}

      let profile = await ensureProfile(fullUser);
      const ghIdentity = fullUser.identities?.find((id) => id.provider === 'github');
      const ghFromIdentity = ghIdentity?.identity_data?.user_name || ghIdentity?.identity_data?.preferred_username;
      const ghUsername = profile?.github_username || fullUser.user_metadata?.github_username || fullUser.user_metadata?.user_name || fullUser.user_metadata?.preferred_username || ghFromIdentity || null;

      if (ghUsername) {
        try {
          console.log(`[/api/auth/me] Manual re-syncing skill profile for connected GitHub user @${ghUsername}...`);
          const ghData = await fetchGitHubData(ghUsername);
          const generated = await generateSkillProfile(ghData);
          if (generated && Object.keys(generated).length > 0) {
            updatePayload.github_username = ghUsername;
            updatePayload.skill_profile = generated;
          }
        } catch (err) {
          console.warn('[/api/auth/me] Manual skill re-sync warning:', err.message);
        }
      }
    }

    if (body.disconnectGithub) {
      updatePayload.github_username = null;
      updatePayload.skill_profile = {};
    }

    if (body.deactivateAccount) {
      updatePayload.status = 'deactivated';
    }

    // Try updating profiles table
    let updatedProfile = null;
    if (Object.keys(updatePayload).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id)
        .select()
        .single();

      if (!error && data) updatedProfile = data;
    }

    // Sync notification preferences, avatar_url, and updated name with Supabase Auth user_metadata
    let currentPrefs = user.user_metadata?.notification_preferences || { taskAssigned: true, joinRequests: true, comments: true };
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          name: body.name !== undefined ? body.name.trim() : user.user_metadata?.name,
          full_name: body.name !== undefined ? body.name.trim() : user.user_metadata?.full_name,
          avatar_url: body.avatarUrl !== undefined ? body.avatarUrl : user.user_metadata?.avatar_url,
          primary_role: body.primaryRole !== undefined ? body.primaryRole.trim() : user.user_metadata?.primary_role,
          notification_preferences: body.notificationPreferences !== undefined ? body.notificationPreferences : currentPrefs,
        },
      });
    } catch (e) {
      console.warn('Auth user_metadata update warning:', e.message);
    }

    const resolvedRole = updatedProfile?.primary_role ||
      (updatedProfile?.role && !['ADMIN', 'MEMBER', 'VIEWER'].includes(updatedProfile.role) ? updatedProfile.role : null) ||
      body.primaryRole ||
      'Other';

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: updatedProfile?.name || body.name || user.email?.split('@')[0],
        primaryRole: resolvedRole,
        githubUsername: updatedProfile?.github_username || null,
        skillProfile: updatedProfile?.skill_profile || {},
        avatarUrl: updatedProfile?.avatar_url || body.avatarUrl || null,
        notificationPreferences: body.notificationPreferences || currentPrefs,
      },
    });
  } catch (error) {
    console.error('Auth /api/auth/me PUT error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
