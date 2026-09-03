import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { Navbar, Footer, Sidebar, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Avatar } from '../../components/ui/Avatar';
import { Lock, Upload, Plus, Trash2, ArrowLeft, Check, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfileEditPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Form states
  const [photoUrl, setPhotoUrl] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [links, setLinks] = useState({ linkedin: '', github: '', portfolio: '' });

  // Alumni-only fields
  const [company, setCompany] = useState('');
  const [designation, setDesignation] = useState('');
  const [mentorshipEnabled, setMentorshipEnabled] = useState(false);
  const [experience, setExperience] = useState<any[]>([]);

  // Education (all roles)
  const [education, setEducation] = useState<any[]>([]);

  useEffect(() => {
    userService
      .getMe()
      .then((res) => {
        const u = res.data.data.user as any;
        setPhotoUrl(u.profilePhotoUrl || '');
        setBio(u.bio || '');
        setLocation(u.location || '');
        setSkillsText((u.skills || []).join(', '));
        setLinks({
          linkedin: u.links?.linkedin || '',
          github: u.links?.github || '',
          portfolio: u.links?.portfolio || '',
        });
        setCompany(u.company || '');
        setDesignation(u.designation || '');
        setMentorshipEnabled(Boolean(u.mentorshipEnabled));
        setExperience(u.experience || []);
        setEducation(u.education || []);
      })
      .catch((err) => {
        toast.error('Failed to load profile data.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image exceeds maximum allowed size of 5MB.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const res = await userService.uploadPhoto(file);
      setPhotoUrl(res.data.data.profilePhotoUrl);
      toast.success('Avatar updated successfully!');
      if (refreshUser) await refreshUser();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to upload avatar.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const addExperienceItem = () => {
    setExperience([
      ...experience,
      { company: '', title: '', startDate: '', endDate: '', description: '' },
    ]);
  };

  const removeExperienceItem = (index: number) => {
    setExperience(experience.filter((_, i) => i !== index));
  };

  const updateExperienceItem = (index: number, field: string, val: string) => {
    const updated = [...experience];
    updated[index][field] = val;
    setExperience(updated);
  };

  const addEducationItem = () => {
    setEducation([
      ...education,
      { institution: '', degree: '', field: '', startYear: new Date().getFullYear(), endYear: undefined },
    ]);
  };

  const removeEducationItem = (index: number) => {
    setEducation(education.filter((_, i) => i !== index));
  };

  const updateEducationItem = (index: number, field: string, val: any) => {
    const updated = [...education];
    updated[index][field] = val;
    setEducation(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const skills = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const cleanLinks: Record<string, string> = {};
    if (links.linkedin.trim()) cleanLinks.linkedin = links.linkedin.trim();
    if (links.github.trim()) cleanLinks.github = links.github.trim();
    if (links.portfolio.trim()) cleanLinks.portfolio = links.portfolio.trim();

    const payload: any = {
      bio: bio.trim(),
      location: location.trim(),
      skills,
      links: cleanLinks,
      education: education.filter((e) => e.institution && e.degree),
    };

    if (user?.role === 'alumni') {
      payload.company = company.trim();
      payload.designation = designation.trim();
      payload.mentorshipEnabled = mentorshipEnabled;
      payload.experience = experience.filter((e) => e.company && e.title);
    }

    try {
      await userService.updateProfile(payload);
      toast.success('Profile updated successfully!');
      if (refreshUser) await refreshUser();
      navigate('/profile');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex container-app px-4 sm:px-6 lg:px-8 py-8 gap-8">
        <Sidebar className="hidden md:flex rounded-card shadow-xs" />

        <main className="flex-1 space-y-6 min-w-0 max-w-3xl">
          <PageHeader
            title="Edit Profile"
            subtitle="Update your public profile, professional history, and mentorship preferences."
            actions={
              <Link to="/profile">
                <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Back to Profile
                </Button>
              </Link>
            }
          />

          <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar Upload Card */}
            <Card className="p-6 border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                Profile Photo
              </h3>
              <div className="flex items-center gap-6">
                <Avatar name={user?.name || ''} src={photoUrl} size="xl" />
                <div className="space-y-2">
                  <label className="btn btn-outline btn-sm cursor-pointer inline-flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    <span>{isUploadingPhoto ? 'Uploading...' : 'Upload New Photo'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                      className="sr-only"
                    />
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Supports JPEG, PNG, or WebP. 5MB maximum file size.
                  </p>
                </div>
              </div>
            </Card>

            {/* Read-Only Institutional Record */}
            <Card className="p-5 bg-slate-50/70 border-slate-200 shadow-xs space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-navy-900">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Institutional Academic Records (Read-Only)</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-slate-500 text-[11px] block">Department</span>
                  <span className="font-semibold text-navy-900">{user?.department || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Batch Year</span>
                  <span className="font-semibold text-navy-900">Class of {user?.batch || '—'}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 italic">
                Institutional records are verified by the university registrar. Contact your institution admin to correct these details.
              </p>
            </Card>

            {/* Basic Info */}
            <Card className="p-6 border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                General Information
              </h3>

              <div className="space-y-4">
                <Input
                  id="location"
                  label="Location"
                  placeholder="e.g. San Francisco, CA or London, UK"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />

                <Textarea
                  id="bio"
                  label="Bio / Summary"
                  placeholder="Share your academic interests, career focus, or areas of specialization..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  helperText="Maximum 1000 characters."
                />

                <Input
                  id="skills"
                  label="Skills (comma separated)"
                  placeholder="e.g. TypeScript, Distributed Systems, Product Management, Machine Learning"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  helperText="Separate multiple skills with commas."
                />
              </div>
            </Card>

            {/* Alumni-Only: Professional & Mentorship */}
            {user?.role === 'alumni' && (
              <Card className="p-6 border-blue-200 bg-blue-50/20 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                      Alumni Professional Profile
                    </h3>
                    <p className="text-xs text-slate-500">Configure your current industry presence.</p>
                  </div>
                  <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                    Alumni Only
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    id="company"
                    label="Current Company / Organization"
                    placeholder="e.g. Google, Stripe, or Hospital Systems"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                  <Input
                    id="designation"
                    label="Job Title / Role"
                    placeholder="e.g. Senior Software Engineer"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                  />
                </div>

                {/* Mentorship Toggle */}
                <div className="p-4 bg-white rounded-xl border border-blue-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label htmlFor="mentorshipToggle" className="text-xs font-bold text-navy-900 cursor-pointer">
                      Open to Mentoring Students
                    </label>
                    <p className="text-[11px] text-slate-500">
                      When enabled, students can request 1-on-1 resume reviews and career guidance.
                    </p>
                  </div>
                  <input
                    id="mentorshipToggle"
                    type="checkbox"
                    checked={mentorshipEnabled}
                    onChange={(e) => setMentorshipEnabled(e.target.checked)}
                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* Experience List */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                      Career Experience
                    </h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addExperienceItem}
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Add Experience
                    </Button>
                  </div>

                  {experience.map((exp, idx) => (
                    <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-navy-900">Position #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeExperienceItem(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Input
                          placeholder="Company name"
                          value={exp.company}
                          onChange={(e) => updateExperienceItem(idx, 'company', e.target.value)}
                        />
                        <Input
                          placeholder="Title / Role"
                          value={exp.title}
                          onChange={(e) => updateExperienceItem(idx, 'title', e.target.value)}
                        />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Input
                          placeholder="Start Date (e.g. 2021-06)"
                          value={exp.startDate}
                          onChange={(e) => updateExperienceItem(idx, 'startDate', e.target.value)}
                        />
                        <Input
                          placeholder="End Date (or leave empty for Present)"
                          value={exp.endDate || ''}
                          onChange={(e) => updateExperienceItem(idx, 'endDate', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Education History */}
            <Card className="p-6 border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                  Academic Education
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEducationItem}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add Education
                </Button>
              </div>

              {education.map((edu, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-navy-900">Education #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeEducationItem(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Input
                      placeholder="Institution name"
                      value={edu.institution}
                      onChange={(e) => updateEducationItem(idx, 'institution', e.target.value)}
                    />
                    <Input
                      placeholder="Degree (e.g. B.Tech)"
                      value={edu.degree}
                      onChange={(e) => updateEducationItem(idx, 'degree', e.target.value)}
                    />
                    <Input
                      placeholder="Field of Study"
                      value={edu.field}
                      onChange={(e) => updateEducationItem(idx, 'field', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </Card>

            {/* Links */}
            <Card className="p-6 border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                External Profile Links
              </h3>
              <div className="space-y-3">
                <Input
                  id="linkLinkedin"
                  label="LinkedIn URL"
                  placeholder="https://linkedin.com/in/username"
                  value={links.linkedin}
                  onChange={(e) => setLinks({ ...links, linkedin: e.target.value })}
                />
                <Input
                  id="linkGithub"
                  label="GitHub URL"
                  placeholder="https://github.com/username"
                  value={links.github}
                  onChange={(e) => setLinks({ ...links, github: e.target.value })}
                />
                <Input
                  id="linkPortfolio"
                  label="Personal Portfolio / Website"
                  placeholder="https://yourwebsite.com"
                  value={links.portfolio}
                  onChange={(e) => setLinks({ ...links, portfolio: e.target.value })}
                />
              </div>
            </Card>

            {/* Save Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <Link to="/profile">
                <Button variant="outline" size="md">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSaving}
                leftIcon={<Check className="w-4 h-4" />}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </main>
      </div>

      <Footer />
    </div>
  );
}
