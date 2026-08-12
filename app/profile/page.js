'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { supabase, fetchWithAuth, getValidAccessToken } from '../../lib/supabase';
import SideNavBar from '../../components/SideNavBar';
import TopAppBar from '../../components/TopAppBar';
import NotificationsPanel from '../../components/NotificationsPanel';
import GitHubConnectModal from '../../components/GitHubConnectModal';
import DeleteAccountModal from '../../components/DeleteAccountModal';

export default function AccountSettingsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Personal Info State
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [primaryRole, setPrimaryRole] = useState('Developer');
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalMsg, setPersonalMsg] = useState('');

  // 2. Email State
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailErr, setEmailErr] = useState('');

  // 3. Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');

  // 4. Notification Preferences State
  const [notifPrefs, setNotifPrefs] = useState({
    taskAssigned: true,
    joinRequests: true,
    comments: true,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  // 5. Skills & Expertise State
  const [manualSkills, setManualSkills] = useState([]);
  const [githubSkills, setGithubSkills] = useState([]);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState('Intermediate');
  const [savingSkills, setSavingSkills] = useState(false);
  const [skillsMsg, setSkillsMsg] = useState('');

  // 6. Danger Zone State
  const [confirmEmailInput, setConfirmEmailInput] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [dangerErr, setDangerErr] = useState('');

  // 7. OAuth & Toast State
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastErr, setToastErr] = useState('');

  // Modals & Panels State
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = async () => {
    try {
      const res = await fetchWithAuth('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {}
  };

  useEffect(() => {
    let isOAuthReturn = false;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('connected') === 'github') {
        isOAuthReturn = true;
        // Clean up URL parameter cleanly without full reload
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    fetchProfileData(isOAuthReturn);
    fetchNotifications();

    // Listen for Auth state changes (e.g. OAuth callback completion)
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        fetchProfileData();
        fetchNotifications();
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const parseSkillProfileToState = (prof) => {
    const manual = [];
    const github = [];

    if (!prof || typeof prof !== 'object') return;

    Object.entries(prof).forEach(([key, val]) => {
      if (typeof val === 'object' && val !== null && !val.weight && !val.source) {
        // Category object
        Object.entries(val).forEach(([sName, sObj]) => {
          const w = typeof sObj === 'object' ? sObj.weight : (typeof sObj === 'number' ? sObj : 0.5);
          const src = typeof sObj === 'object' ? (sObj.source || 'github') : 'github';
          const level = w >= 0.8 ? 'Advanced' : (w >= 0.5 ? 'Intermediate' : 'Beginner');
          const entry = { id: `${sName}-${Math.random()}`, skill: sName, level, weight: w, source: src, category: key };
          if (src === 'manual') manual.push(entry);
          else github.push(entry);
        });
      } else {
        // Flat entry
        const w = typeof val === 'object' ? val.weight : (typeof val === 'number' ? val : 0.5);
        const src = typeof val === 'object' ? (val.source || 'manual') : 'manual';
        const level = w >= 0.8 ? 'Advanced' : (w >= 0.5 ? 'Intermediate' : 'Beginner');
        const entry = { id: `${key}-${Math.random()}`, skill: key, level, weight: w, source: src };
        if (src === 'manual') manual.push(entry);
        else github.push(entry);
      }
    });

    setManualSkills(manual);
    setGithubSkills(github);
  };

  const fetchProfileData = async (isOAuthReturn = false) => {
    try {
      let token = await getValidAccessToken();
      if (isOAuthReturn) {
        // Force fresh session token after OAuth redirect
        const sessionRes = await supabase.auth.getSession();
        if (sessionRes.data?.session?.access_token) {
          token = sessionRes.data.session.access_token;
        }
      }

      if (!token) {
        setLoading(false);
        window.location.href = '/login';
        return;
      }

      const res = await fetchWithAuth('/api/auth/me', { token });
      if (!res.ok) {
        setLoading(false);
        window.location.href = '/login';
        return;
      }

      const data = await res.json();
      setUser(data.user);
      setName(data.user.name || '');
      setAvatarUrl(data.user.avatarUrl || '');
      setPrimaryRole(data.user.primaryRole || 'Developer');
      if (data.user.notificationPreferences) {
        setNotifPrefs(data.user.notificationPreferences);
      }
      parseSkillProfileToState(data.user.skillProfile);

      // STEP 4: Toast Honesty - Only show success toast AFTER DB write is verified in fetchProfileData!
      if (isOAuthReturn) {
        if (data.user?.githubUsername) {
          setToastMsg(`✓ GitHub connected successfully as @${data.user.githubUsername}!`);
          setToastErr('');
        } else {
          setToastErr('GitHub connection failed to save in database. Please try connecting again.');
          setToastMsg('');
        }
        setTimeout(() => {
          setToastMsg('');
          setToastErr('');
        }, 5000);
      }

      return data.user;
    } catch (err) {
      console.error('Failed to load profile settings:', err);
      if (isOAuthReturn) {
        setToastErr('GitHub connection error: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddManualSkill = (e) => {
    if (e) e.preventDefault();
    const trimmed = newSkillInput.trim();
    if (!trimmed) return;

    if (manualSkills.some((s) => s.skill.toLowerCase() === trimmed.toLowerCase())) {
      setNewSkillInput('');
      return;
    }

    const weightMap = { 'Beginner': 0.30, 'Intermediate': 0.60, 'Advanced': 0.90 };
    const w = weightMap[newSkillLevel] || 0.60;

    const newEntry = {
      id: `manual-${Date.now()}-${Math.random()}`,
      skill: trimmed,
      level: newSkillLevel,
      weight: w,
      source: 'manual',
    };

    setManualSkills((prev) => [...prev, newEntry]);
    setNewSkillInput('');
  };

  const handleRemoveManualSkill = (idToRemove) => {
    setManualSkills((prev) => prev.filter((s) => s.id !== idToRemove));
  };

  const handleSaveSkills = async () => {
    setSavingSkills(true);
    setSkillsMsg('');

    try {
      const combined = {};

      githubSkills.forEach((g) => {
        const cat = g.category || 'Backend';
        if (!combined[cat]) combined[cat] = {};
        combined[cat][g.skill] = { weight: g.weight, source: 'github' };
      });

      manualSkills.forEach((m) => {
        const cat = m.category || 'Backend';
        if (!combined[cat]) combined[cat] = {};
        combined[cat][m.skill] = { weight: m.weight, source: 'manual' };
      });

      const res = await fetchWithAuth('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillProfile: combined }),
      });

      if (!res.ok) throw new Error('Failed to save skill profile');

      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        parseSkillProfileToState(data.user.skillProfile);
      }
      setSkillsMsg('Skill profile saved!');
      setTimeout(() => setSkillsMsg(''), 3500);
    } catch (err) {
      setSkillsMsg(`Error: ${err.message}`);
    } finally {
      setSavingSkills(false);
    }
  };

  // Section 1: Save Personal Info
  const handleSavePersonalInfo = async (e) => {
    e.preventDefault();
    setSavingPersonal(true);
    setPersonalMsg('');

    try {
      const res = await fetchWithAuth('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          avatarUrl: avatarUrl.trim() || null,
          primaryRole: primaryRole.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setPersonalMsg('Personal information updated successfully!');
      } else {
        const err = await res.json();
        setPersonalMsg(`Error: ${err.error || 'Failed to update personal info'}`);
      }
    } catch (err) {
      setPersonalMsg(`Error: ${err.message}`);
    } finally {
      setSavingPersonal(false);
    }
  };

  // Avatar File Upload Handler
  const handleAvatarFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Section 2: Save Email Change
  const handleSaveEmail = async (e) => {
    e.preventDefault();
    if (!newEmail || newEmail.trim() === user?.email) return;

    setSavingEmail(true);
    setEmailMsg('');
    setEmailErr('');

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) {
        setEmailErr(error.message);
      } else {
        setEmailMsg(`Check your new email (${newEmail.trim()}) to confirm the change.`);
        setNewEmail('');
      }
    } catch (err) {
      setEmailErr(err.message);
    } finally {
      setSavingEmail(false);
    }
  };

  // Section 3: Password Update
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');

    if (newPassword.length < 6) {
      setPasswordErr('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErr('New passwords do not match.');
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordErr(error.message);
      } else {
        setPasswordMsg('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setPasswordErr(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  // Direct GitHub Connect OAuth Trigger
  const handleDirectConnectGitHub = async () => {
    setConnectingGithub(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const redirectUrl = `${origin}/profile?connected=github`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          scopes: 'read:user public_repo',
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error('GitHub connection error:', err);
      setConnectingGithub(false);
    }
  };

  // Re-sync GitHub Skill Profile
  const [syncingSkills, setSyncingSkills] = useState(false);

  const handleSyncGithubSkills = async () => {
    setSyncingSkills(true);
    setToastMsg('');
    setToastErr('');
    try {
      const res = await fetchWithAuth('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncGithubSkills: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        parseSkillProfileToState(data.user.skillProfile);
        setToastMsg('✓ GitHub skill profile synced successfully!');
      } else {
        setToastErr('Failed to sync GitHub skill profile.');
      }
    } catch (err) {
      setToastErr('Skill sync error: ' + err.message);
    } finally {
      setSyncingSkills(false);
      setTimeout(() => {
        setToastMsg('');
        setToastErr('');
      }, 4500);
    }
  };

  // Section 4: Disconnect GitHub
  const handleDisconnectGitHub = async () => {
    if (!confirm('Disconnecting GitHub will remove your skill profile and AI candidate matching. Are you sure?')) {
      return;
    }

    try {
      const res = await fetchWithAuth('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disconnectGithub: true }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Failed to disconnect GitHub:', err);
    }
  };

  // Section 5: Toggle Notification Preferences
  const handleTogglePref = async (key) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    setSavingNotifs(true);

    try {
      await fetchWithAuth('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationPreferences: updated }),
      });
    } catch (err) {
      console.error('Failed to update notification preferences:', err);
    } finally {
      setSavingNotifs(false);
    }
  };

  // Section 6: Danger Zone Deactivation
  const handleDeactivateAccount = async (e) => {
    e.preventDefault();
    if (confirmEmailInput.trim() !== user?.email) {
      setDangerErr('Please type your exact email to confirm deactivation.');
      return;
    }

    setDeactivating(true);
    setDangerErr('');

    try {
      await fetchWithAuth('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deactivateAccount: true }),
      });

      await supabase.auth.signOut();
      window.location.href = '/login?deactivated=true';
    } catch (err) {
      setDangerErr(err.message || 'Failed to deactivate account.');
      setDeactivating(false);
    }
  };

  const isOAuthOnly = user?.identities && user.identities.length > 0 && user.identities.every((i) => i.provider !== 'email');
  const isGithubConnected = Boolean(user?.githubUsername);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col md:flex-row">
      <SideNavBar onCreateProject={() => (window.location.href = '/?action=create')} />

      <div className="flex-1 flex flex-col md:ml-64">
        <TopAppBar
          user={user}
          onOpenNotifications={() => setShowNotifications(true)}
          unreadCount={notifications.length}
        />

        <main className="flex-1 p-lg max-w-4xl w-full mx-auto flex flex-col gap-lg pb-24">
          {/* Header */}
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">Account Settings</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Manage your profile, authentication preferences, integrations, and notification settings
            </p>
          </div>

          {/* Toast Notification Banners */}
          {toastMsg && (
            <div className="p-4 bg-[#DCFCE7] border border-[#BBF7D0] text-[#166534] rounded-xl font-medium text-sm flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#15803D]">check_circle</span>
                <span>{toastMsg}</span>
              </div>
              <button onClick={() => setToastMsg('')} className="text-[#15803D] hover:text-[#166534] p-1 cursor-pointer">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {toastErr && (
            <div className="p-4 bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] rounded-xl font-medium text-sm flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#DC2626]">error</span>
                <span>{toastErr}</span>
              </div>
              <button onClick={() => setToastErr('')} className="text-[#DC2626] hover:text-[#991B1B] p-1 cursor-pointer">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {/* Section 1: Personal Info */}
          <div className="bg-surface p-lg rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col gap-md">
            <h2 className="font-title-lg text-title-lg text-on-surface font-bold flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary">person</span>
              Personal Information
            </h2>

            <form onSubmit={handleSavePersonalInfo} className="flex flex-col gap-md">
              <div className="flex items-center gap-md">
                <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-primary font-bold text-2xl overflow-hidden shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (name || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-title-md text-title-md text-on-surface font-bold">{name || 'User'}</span>
                  <span className="font-body-md text-sm text-on-surface-variant">{user?.email}</span>
                </div>
              </div>

              {personalMsg && <p className="font-body-md text-sm text-primary font-semibold">{personalMsg}</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-surface-container-low border border-outline-variant rounded-lg p-md font-body-md text-on-surface outline-none focus:border-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">Avatar Image URL</label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="bg-surface-container-low border border-outline-variant rounded-lg p-md font-body-md text-on-surface outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-xs md:col-span-2">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">Primary Role</label>
                  <select
                    value={primaryRole}
                    onChange={(e) => setPrimaryRole(e.target.value)}
                    className="bg-surface-container-low border border-outline-variant rounded-lg p-md font-body-md text-on-surface outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Developer">Developer</option>
                    <option value="Designer">Designer</option>
                    <option value="Product Manager">Product Manager</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPersonal}
                  className="bg-primary text-on-primary px-md py-xs rounded-lg font-title-md text-title-md hover:bg-on-primary-fixed-variant transition-colors cursor-pointer"
                >
                  {savingPersonal ? 'Saving...' : 'Save Personal Info'}
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Account Email */}
          <div className="bg-surface p-lg rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col gap-md">
            <h2 className="font-title-lg text-title-lg text-on-surface font-bold flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary">mail</span>
              Account Email
            </h2>

            <p className="font-body-md text-sm text-on-surface-variant">
              Current email: <strong className="text-on-surface">{user?.email}</strong>
            </p>

            <form onSubmit={handleSaveEmail} className="flex flex-col gap-md">
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface font-semibold">New Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="newemail@example.com"
                  className="bg-surface-container-low border border-outline-variant rounded-lg p-md font-body-md text-on-surface outline-none focus:border-primary"
                  required
                />
              </div>

              {emailMsg && <p className="font-body-md text-sm text-primary font-semibold">{emailMsg}</p>}
              {emailErr && <p className="font-body-md text-sm text-error">{emailErr}</p>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="bg-primary text-on-primary px-md py-xs rounded-lg font-title-md text-title-md hover:bg-on-primary-fixed-variant transition-colors cursor-pointer"
                >
                  {savingEmail ? 'Updating...' : 'Update Email'}
                </button>
              </div>
            </form>
          </div>

          {/* Section 3: Password Update */}
          <div className="bg-surface p-lg rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col gap-md">
            <h2 className="font-title-lg text-title-lg text-on-surface font-bold flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary">lock</span>
              Change Password
            </h2>

            {isOAuthOnly ? (
              <p className="font-body-md text-sm text-on-surface-variant">
                You signed in with GitHub/Google OAuth — no password set for this account.
              </p>
            ) : (
              <form onSubmit={handleSavePassword} className="flex flex-col gap-md">
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="bg-surface-container-low border border-outline-variant rounded-lg p-md font-body-md text-on-surface outline-none focus:border-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-surface-container-low border border-outline-variant rounded-lg p-md font-body-md text-on-surface outline-none focus:border-primary"
                    required
                  />
                </div>

                {passwordMsg && <p className="font-body-md text-sm text-primary font-semibold">{passwordMsg}</p>}
                {passwordErr && <p className="font-body-md text-sm text-error">{passwordErr}</p>}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="bg-primary text-on-primary px-md py-xs rounded-lg font-title-md text-title-md hover:bg-on-primary-fixed-variant transition-colors cursor-pointer"
                  >
                    {savingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Section 4: Connected Accounts */}
          <div className="bg-surface p-lg rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col gap-md">
            <h2 className="font-title-lg text-title-lg text-on-surface font-bold flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary">hub</span>
              Connected Accounts & Integrations
            </h2>

            <div className="flex flex-col gap-sm">
              {/* GitHub Card */}
              <div className="p-md bg-surface-container-lowest border border-outline-variant/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-md">
                  <span className="material-symbols-outlined text-[24px] text-primary">code</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-title-md text-title-md text-on-surface font-bold">GitHub Skill Profile</h3>
                      {isGithubConnected && (
                        <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#166534] text-[11px] font-semibold border border-[#BBF7D0] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-[#15803D]">check_circle</span>
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="font-body-md text-sm text-on-surface-variant">
                      {isGithubConnected
                        ? `Connected as @${user.githubUsername}`
                        : 'Connect GitHub to analyze repo skills and enable AI candidate matching'}
                    </p>
                  </div>
                </div>

                {isGithubConnected ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSyncGithubSkills}
                      disabled={syncingSkills}
                      className="bg-primary/10 text-primary border border-primary/20 px-3.5 py-1.5 rounded-lg font-label-md text-label-md hover:bg-primary/20 transition-colors cursor-pointer flex items-center gap-1.5 font-medium disabled:opacity-50"
                      title="Fetch latest GitHub repos and re-generate AI skill profile"
                    >
                      <span className={`material-symbols-outlined text-[16px] ${syncingSkills ? 'animate-spin' : ''}`}>
                        sync
                      </span>
                      {syncingSkills ? 'Syncing...' : 'Sync Skills'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectGitHub}
                      className="bg-error-container/20 text-error border border-error/30 px-3.5 py-1.5 rounded-lg font-label-md text-label-md hover:bg-error-container/40 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">link_off</span> Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleDirectConnectGitHub}
                    disabled={connectingGithub}
                    className="bg-primary text-on-primary px-4 py-1.5 rounded-lg font-label-md text-label-md hover:bg-on-primary-fixed-variant transition-colors cursor-pointer flex items-center gap-1.5 font-medium shadow-sm disabled:opacity-70"
                  >
                    {connectingGithub ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">code</span>
                        <span>Connect GitHub</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Google Card */}
              <div className="p-md bg-surface-container-lowest border border-outline-variant/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-md">
                  <span className="material-symbols-outlined text-[24px] text-secondary">g_mobiledata</span>
                  <div>
                    <h3 className="font-title-md text-title-md text-on-surface font-bold">Google Account</h3>
                    <p className="font-body-md text-sm text-on-surface-variant">
                      Used for single sign-on authentication
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-bold border border-outline-variant/30">
                  SSO Available
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Skills & Expertise (Manual & GitHub Merged) */}
          <div className="bg-surface p-lg rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col gap-md">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-title-lg text-title-lg text-on-surface font-bold flex items-center gap-xs">
                  <span className="material-symbols-outlined text-primary">psychology</span>
                  Skills & Expertise
                </h2>
                <p className="font-body-md text-sm text-on-surface-variant mt-0.5">
                  {isGithubConnected
                    ? 'Manage your unified skill profile (GitHub repo skills + custom manual skills).'
                    : 'Add your skills manually to participate in AI task assignment candidate matching.'}
                </p>
              </div>
              {skillsMsg && (
                <span className="text-xs font-semibold text-[#166534] bg-[#DCFCE7] px-3 py-1 rounded-full border border-[#BBF7D0]">
                  {skillsMsg}
                </span>
              )}
            </div>

            {/* Auto-Detected GitHub Skills Display */}
            {isGithubConnected && (
              <div className="p-md bg-[#EEF2FF] border border-[#4F46E5]/20 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#4F46E5] uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">code</span>
                    Auto-Detected GitHub Skills
                  </span>
                  <span className="text-[11px] text-[#52525B]">Connected as @{user.githubUsername}</span>
                </div>

                {githubSkills.length === 0 ? (
                  <p className="text-xs text-[#52525B]">No GitHub repository skills detected yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {githubSkills.map((g) => (
                      <div key={g.id} className="bg-white text-[#4F46E5] text-xs font-medium px-2.5 py-1 rounded-lg border border-[#4F46E5]/30 flex items-center gap-1.5 shadow-sm">
                        <span className="material-symbols-outlined text-[14px]">code</span>
                        <span>{g.skill}</span>
                        <span className="bg-[#EEF2FF] text-[10px] px-1.5 py-0.5 rounded font-semibold text-[#4338CA]">
                          {Math.round(g.weight * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tag Input Form for Manual Skills */}
            <div className="p-md bg-surface-container-lowest border border-outline-variant/30 rounded-xl flex flex-col gap-md">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-primary">edit_note</span>
                {isGithubConnected ? 'Add Additional Skills Manually (Non-GitHub)' : 'Add Your Skills Manually'}
              </span>

              <form onSubmit={handleAddManualSkill} className="flex flex-wrap md:flex-nowrap gap-2 items-center">
                <input
                  type="text"
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  placeholder="e.g. React, Figma, Python, Project Management"
                  maxLength={40}
                  className="flex-1 min-w-[200px] h-[40px] px-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface text-sm focus:border-primary focus:outline-none"
                />
                
                <select
                  value={newSkillLevel}
                  onChange={(e) => setNewSkillLevel(e.target.value)}
                  className="h-[40px] px-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface text-sm focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="Beginner">Beginner (30%)</option>
                  <option value="Intermediate">Intermediate (60%)</option>
                  <option value="Advanced">Advanced (90%)</option>
                </select>

                <button
                  type="submit"
                  className="h-[40px] px-4 rounded-lg bg-primary text-on-primary font-label-md text-sm hover:bg-on-primary-fixed-variant transition-colors cursor-pointer flex items-center gap-1 shrink-0 font-medium"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span> Add Skill
                </button>
              </form>

              {/* Display Manual Skill Tags */}
              <div>
                <span className="text-xs text-on-surface-variant font-medium block mb-2">
                  {manualSkills.length > 0 ? 'Your Self-Reported Skills:' : 'No manual skills added yet. Type a skill above to start.'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {manualSkills.map((m) => (
                    <div
                      key={m.id}
                      className="bg-surface border border-outline-variant/50 text-on-surface text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[14px] text-secondary">edit</span>
                      <span>{m.skill}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        m.level === 'Advanced' ? 'bg-[#DCFCE7] text-[#15803D]' :
                        m.level === 'Intermediate' ? 'bg-[#FEF9C3] text-[#A16207]' :
                        'bg-[#F3F4F6] text-[#4B5563]'
                      }`}>
                        {m.level}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveManualSkill(m.id)}
                        className="text-on-surface-variant hover:text-error transition-colors p-0.5 rounded cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveSkills}
                disabled={savingSkills}
                className="bg-primary text-on-primary px-5 py-2 rounded-xl font-label-md text-sm font-semibold hover:bg-on-primary-fixed-variant transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {savingSkills ? 'Saving...' : 'Save Skills'}
              </button>
            </div>
          </div>

          {/* Section 5: Notification Preferences */}
          <div className="bg-surface p-lg rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col gap-md">
            <div className="flex justify-between items-center">
              <h2 className="font-title-lg text-title-lg text-on-surface font-bold flex items-center gap-xs">
                <span className="material-symbols-outlined text-primary">notifications</span>
                Notification Preferences
              </h2>
              {savingNotifs && <span className="font-label-sm text-xs text-primary font-bold">Saving...</span>}
            </div>

            <div className="flex flex-col gap-sm">
              <div className="flex items-center justify-between p-md bg-surface-container-lowest border border-outline-variant/30 rounded-xl">
                <div>
                  <h4 className="font-title-md text-title-md text-on-surface font-semibold">Task Assignment Notifications</h4>
                  <p className="font-body-md text-sm text-on-surface-variant">Receive notifications when an Admin assigns a task to you</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.taskAssigned}
                  onChange={() => handleTogglePref('taskAssigned')}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-md bg-surface-container-lowest border border-outline-variant/30 rounded-xl">
                <div>
                  <h4 className="font-title-md text-title-md text-on-surface font-semibold">Join Request Notifications</h4>
                  <p className="font-body-md text-sm text-on-surface-variant">Receive notifications when users request to join your projects</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.joinRequests}
                  onChange={() => handleTogglePref('joinRequests')}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-md bg-surface-container-lowest border border-outline-variant/30 rounded-xl">
                <div>
                  <h4 className="font-title-md text-title-md text-on-surface font-semibold">Comment Notifications</h4>
                  <p className="font-body-md text-sm text-on-surface-variant">Receive notifications when teammates comment on tasks</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.comments}
                  onChange={() => handleTogglePref('comments')}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Section 6: Danger Zone */}
          <div className="bg-error-container/10 p-lg rounded-2xl border-2 border-error/40 shadow-sm flex flex-col gap-lg">
            <div>
              <h2 className="font-title-lg text-title-lg text-error font-bold flex items-center gap-xs">
                <span className="material-symbols-outlined text-error">warning</span>
                Danger Zone
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                Manage account deactivation or permanent account deletion.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {/* Option A: Deactivate Account */}
              <div className="p-md bg-surface-container-lowest border border-error/30 rounded-xl flex flex-col justify-between gap-md shadow-xs">
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-2 text-on-surface font-bold font-title-md">
                    <span className="material-symbols-outlined text-amber-600">pause_circle</span>
                    <span>Deactivate Account</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Soft, reversible suspension. Keeps your profile, projects, and task data intact while disabling login.
                  </p>
                </div>

                <form onSubmit={handleDeactivateAccount} className="flex flex-col gap-sm">
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
                      Type email (<span className="font-mono text-error font-bold">{user?.email}</span>):
                    </label>
                    <input
                      type="email"
                      value={confirmEmailInput}
                      onChange={(e) => setConfirmEmailInput(e.target.value)}
                      placeholder={user?.email}
                      className="bg-surface-container-low border border-outline-variant rounded-lg p-xs font-body-sm text-on-surface outline-none"
                      required
                    />
                  </div>

                  {dangerErr && <p className="font-body-sm text-xs text-error font-semibold">{dangerErr}</p>}

                  <button
                    type="submit"
                    disabled={deactivating || confirmEmailInput.trim() !== user?.email}
                    className="w-full bg-surface-container-high text-on-surface py-2 rounded-lg font-label-md text-label-md hover:bg-surface-container-highest transition-colors cursor-pointer disabled:opacity-50 font-bold border border-outline-variant/30"
                  >
                    {deactivating ? 'Deactivating...' : 'Deactivate Account'}
                  </button>
                </form>
              </div>

              {/* Option B: Delete Account (Permanent) */}
              <div className="p-md bg-error-container/20 border-2 border-error/50 rounded-xl flex flex-col justify-between gap-md shadow-xs">
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-2 text-error font-bold font-title-md">
                    <span className="material-symbols-outlined text-error">delete_forever</span>
                    <span>Delete Account Permanently</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Irreversible removal. Purges your profile and auth record permanently. Single-member projects are deleted.
                  </p>
                </div>

                <div className="flex flex-col gap-sm pt-4 border-t border-error/20">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="w-full bg-error text-on-error py-2.5 rounded-lg font-title-md text-title-md font-bold hover:bg-error/80 transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                    Delete Account Permanently
                  </button>
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>

      {/* Notifications Panel */}
      {showNotifications && (
        <NotificationsPanel
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkAllRead={async () => {
            setNotifications([]);
            try {
              await fetchWithAuth('/api/notifications', { method: 'DELETE' });
            } catch (e) {}
          }}
          onNotificationUpdated={fetchNotifications}
        />
      )}

      {/* GitHub Connect Modal */}
      {showGitHubModal && (
        <GitHubConnectModal
          user={user}
          onClose={() => setShowGitHubModal(false)}
          onSuccess={(updatedUser) => {
            setUser(updatedUser);
            setShowGitHubModal(false);
          }}
        />
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <DeleteAccountModal
          user={user}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
