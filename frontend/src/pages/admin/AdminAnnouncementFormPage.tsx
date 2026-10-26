import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Navbar, Footer, Sidebar, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { announcementsService } from '../../services/announcements';
import {
  ANNOUNCEMENT_CATEGORIES,
  AnnouncementCategory,
  CreateAnnouncementInput,
} from '../../types';
import { ArrowLeft, Save, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const TITLE_MAX = 150;
const SUMMARY_MAX = 300;
const CONTENT_MAX = 10000;
const COVER_URL_MAX = 2048;

export default function AdminAnnouncementFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('General');
  const [coverImage, setCoverImage] = useState('');
  const [published, setPublished] = useState(false);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!isEditing || !id) return;
    let isMounted = true;

    const fetchDetail = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const item = await announcementsService.getAnnouncementById(id);
        if (!isMounted) return;
        setTitle(item.title);
        setSummary(item.summary);
        setContent(item.content || '');
        setCategory(item.category);
        setCoverImage(item.coverImage || '');
        setPublished(item.published);
      } catch (err: any) {
        if (!isMounted) return;
        const msg = err.response?.data?.error?.message || 'Failed to load announcement.';
        setFetchError(msg);
        toast.error(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [id, isEditing]);

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      errs.title = 'Title is required.';
    } else if (trimmedTitle.length > TITLE_MAX) {
      errs.title = `Title must not exceed ${TITLE_MAX} characters.`;
    }

    const trimmedSummary = summary.trim();
    if (!trimmedSummary) {
      errs.summary = 'Summary is required.';
    } else if (trimmedSummary.length > SUMMARY_MAX) {
      errs.summary = `Summary must not exceed ${SUMMARY_MAX} characters.`;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      errs.content = 'Content is required.';
    } else if (trimmedContent.length > CONTENT_MAX) {
      errs.content = `Content must not exceed ${CONTENT_MAX} characters.`;
    }

    if (!ANNOUNCEMENT_CATEGORIES.includes(category)) {
      errs.category = 'Please select a valid category.';
    }

    const trimmedCover = coverImage.trim();
    if (trimmedCover) {
      if (trimmedCover.length > COVER_URL_MAX) {
        errs.coverImage = `Cover image URL must not exceed ${COVER_URL_MAX} characters.`;
      } else {
        try {
          const parsed = new URL(trimmedCover);
          if (parsed.protocol !== 'https:') {
            errs.coverImage = 'Cover image URL must use the https:// protocol.';
          } else if (parsed.username || parsed.password) {
            errs.coverImage = 'Cover image URL must not contain credentials.';
          }
        } catch {
          errs.coverImage = 'Please provide a valid HTTPS URL.';
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please correct the errors in the form.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateAnnouncementInput = {
        title: title.trim(),
        summary: summary.trim(),
        content: content.trim(),
        category,
        published,
      };

      const trimmedCover = coverImage.trim();
      if (trimmedCover) {
        payload.coverImage = trimmedCover;
      }

      if (isEditing && id) {
        await announcementsService.updateAnnouncement(id, payload);
        toast.success(
          published
            ? 'Announcement updated and published!'
            : 'Announcement updated and saved as draft.'
        );
      } else {
        await announcementsService.createAnnouncement(payload);
        toast.success(
          published
            ? 'Announcement created and published!'
            : 'Announcement saved as draft.'
        );
      }

      navigate('/admin/announcements');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to save announcement.';
      toast.error(msg);
      // Retain user input on error so they don't lose work
      if (err.response?.data?.error?.details) {
        const serverDetails = err.response.data.error.details;
        const newErrs: { [key: string]: string } = {};
        if (Array.isArray(serverDetails)) {
          serverDetails.forEach((d: any) => {
            if (d.field) newErrs[d.field] = d.message;
          });
          setErrors((prev) => ({ ...prev, ...newErrs }));
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="hidden lg:block lg:col-span-1">
            <Sidebar />
          </div>

          <main className="lg:col-span-3">
            <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
              <div>
                <Link
                  to="/admin/announcements"
                  className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 mb-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Back to Manage Announcements
                </Link>
                <PageHeader
                  title={isEditing ? 'Edit Announcement' : 'Create New Announcement'}
                  subtitle={
                    isEditing
                      ? 'Update content, category, or publication status.'
                      : 'Publish an official notice or save a draft for campus members.'
                  }
                />
              </div>
            </div>

            {isLoading ? (
              <Card className="p-8 text-center text-slate-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
                <p>Loading announcement details...</p>
              </Card>
            ) : fetchError ? (
              <Card className="p-8 text-center">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Error Loading Announcement</h2>
                <p className="text-slate-600 mb-6">{fetchError}</p>
                <Link to="/admin/announcements">
                  <Button variant="outline">Return to Announcements List</Button>
                </Link>
              </Card>
            ) : (
              <Card className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} noValidate className="space-y-6">
                  {/* Title */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="announcement-title" className="label mb-0">
                        Title <span className="text-red-600 ml-0.5">*</span>
                      </label>
                      <span
                        className={`text-xs ${
                          title.length > TITLE_MAX ? 'text-red-600 font-semibold' : 'text-slate-500'
                        }`}
                        aria-live="polite"
                      >
                        {title.length} / {TITLE_MAX}
                      </span>
                    </div>
                    <Input
                      id="announcement-title"
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
                      }}
                      placeholder="e.g., Campus Placement Drive 2026 Registration Open"
                      required
                      error={errors.title}
                      maxLength={TITLE_MAX + 20}
                    />
                  </div>

                  {/* Category & Cover Image */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="announcement-category" className="label mb-1">
                        Category <span className="text-red-600 ml-0.5">*</span>
                      </label>
                      <Select
                        id="announcement-category"
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value as AnnouncementCategory);
                          if (errors.category) setErrors((prev) => ({ ...prev, category: '' }));
                        }}
                        required
                        error={errors.category}
                      >
                        {ANNOUNCEMENT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="announcement-cover" className="label mb-0">
                          Cover Image URL (Optional)
                        </label>
                        <span className="text-xs text-slate-500">HTTPS only</span>
                      </div>
                      <Input
                        id="announcement-cover"
                        type="url"
                        value={coverImage}
                        onChange={(e) => {
                          setCoverImage(e.target.value);
                          if (errors.coverImage) setErrors((prev) => ({ ...prev, coverImage: '' }));
                        }}
                        placeholder="https://example.com/banner.jpg"
                        error={errors.coverImage}
                        maxLength={COVER_URL_MAX}
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="announcement-summary" className="label mb-0">
                        Summary <span className="text-red-600 ml-0.5">*</span>
                      </label>
                      <span
                        className={`text-xs ${
                          summary.length > SUMMARY_MAX ? 'text-red-600 font-semibold' : 'text-slate-500'
                        }`}
                        aria-live="polite"
                      >
                        {summary.length} / {SUMMARY_MAX}
                      </span>
                    </div>
                    <Textarea
                      id="announcement-summary"
                      rows={2}
                      value={summary}
                      onChange={(e) => {
                        setSummary(e.target.value);
                        if (errors.summary) setErrors((prev) => ({ ...prev, summary: '' }));
                      }}
                      placeholder="A concise synopsis shown on feeds, cards, and notification banners..."
                      required
                      error={errors.summary}
                      maxLength={SUMMARY_MAX + 50}
                    />
                  </div>

                  {/* Content */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="announcement-content" className="label mb-0">
                        Full Content <span className="text-red-600 ml-0.5">*</span>
                      </label>
                      <span
                        className={`text-xs ${
                          content.length > CONTENT_MAX ? 'text-red-600 font-semibold' : 'text-slate-500'
                        }`}
                        aria-live="polite"
                      >
                        {content.length} / {CONTENT_MAX}
                      </span>
                    </div>
                    <Textarea
                      id="announcement-content"
                      rows={10}
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        if (errors.content) setErrors((prev) => ({ ...prev, content: '' }));
                      }}
                      placeholder="Write the full announcement text here. Plain text line breaks are preserved..."
                      required
                      error={errors.content}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      Note: Content is stored and rendered safely as plain text. Line breaks are preserved.
                    </p>
                  </div>

                  {/* Publication Toggle */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center space-x-3">
                      <input
                        id="announcement-published"
                        type="checkbox"
                        checked={published}
                        onChange={(e) => setPublished(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                      />
                      <label htmlFor="announcement-published" className="text-sm font-medium text-slate-900 cursor-pointer">
                        Publish immediately to all campus users
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 ml-7">
                      {published
                        ? 'This item will be publicly visible to students and alumni immediately.'
                        : 'This item will be saved as a draft. Only admins can view drafts.'}
                    </p>
                  </div>

                  {/* Form Actions */}
                  <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
                    <Link to="/admin/announcements">
                      <Button type="button" variant="outline" disabled={isSubmitting}>
                        Cancel
                      </Button>
                    </Link>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting}
                      className="inline-flex items-center space-x-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>{isEditing ? 'Save Changes' : 'Create Announcement'}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            )}
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}
