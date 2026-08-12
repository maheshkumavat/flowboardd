import { NextResponse } from 'next/server';
import { fetchGitHubData, generateSkillProfile } from '../../../../lib/ai/githubSkillMatcher';
import { supabaseAdmin, getServerUser } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { githubUsername, accessToken } = body;

    const username = githubUsername ? githubUsername.trim() : null;

    if (!username) {
      return NextResponse.json({ error: 'GitHub username is required' }, { status: 400 });
    }

    const githubData = await fetchGitHubData(username, accessToken || null);
    const skillProfileObj = await generateSkillProfile(githubData) || {};

    let updatedProfile = null;

    const { data, error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        github_username: username,
        skill_profile: skillProfileObj,
      })
      .eq('id', user.id)
      .select()
      .single();
    
    if (updateErr) {
      console.error('[github-skills API] supabaseAdmin update error:', updateErr);
    }
    updatedProfile = data;

    return NextResponse.json({
      message: 'Skill profile generated successfully',
      skillProfile: skillProfileObj,
      user: updatedProfile ? {
        id: updatedProfile.id,
        name: updatedProfile.name,
        email: updatedProfile.email,
        githubUsername: updatedProfile.github_username,
        skillProfile: updatedProfile.skill_profile || {},
      } : null,
      githubSummary: {
        username,
        reposAnalyzed: githubData.totalRepos,
        topLanguages: Object.keys(githubData.languageCounts || {}),
      },
    });
  } catch (error) {
    console.error('GitHub skills API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process GitHub skill profile' }, { status: 500 });
  }
}

