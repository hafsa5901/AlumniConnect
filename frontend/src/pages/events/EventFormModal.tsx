import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { eventsService, CreateEventPayload, EventCategory, EventLocationType } from '../../services/events';
import { Calendar, Clock, MapPin, Link as LinkIcon, Users, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userRole?: string;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userRole,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('webinar');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [locationType, setLocationType] = useState<EventLocationType>('virtual');
  const [venueOrLink, setVenueOrLink] = useState('');
  const [capacity, setCapacity] = useState<string>('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('webinar');
    setStartDate('');
    setEndDate('');
    setLocationType('virtual');
    setVenueOrLink('');
    setCapacity('');
    setBannerUrl('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !description.trim() || !startDate || !endDate || !venueOrLink.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError('End date and time must be after start date and time.');
      return;
    }

    const payload: CreateEventPayload = {
      title: title.trim(),
      description: description.trim(),
      category,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      locationType,
      venueOrLink: venueOrLink.trim(),
      capacity: capacity ? parseInt(capacity, 10) : null,
      bannerUrl: bannerUrl.trim() || null,
    };

    setIsSubmitting(true);
    try {
      await eventsService.createEvent(payload);
      if (userRole === 'admin') {
        toast.success('Event published successfully!');
      } else {
        toast.success('Event submitted for administrator review.');
      }
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to create event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Create New Event"
      description={
        userRole === 'admin'
          ? 'Host an official institutional reunion, webinar, or career workshop.'
          : 'Host an alumni tech talk, networking session, or workshop. Alumni-created events go live after admin approval.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        <Input
          id="eventTitle"
          label="Event Title"
          placeholder="e.g. Distributed Systems Masterclass"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            id="eventCategory"
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as EventCategory)}
            options={[
              { value: 'webinar', label: 'Webinar' },
              { value: 'workshop', label: 'Workshop' },
              { value: 'career', label: 'Career Fair / Panel' },
              { value: 'networking', label: 'Networking Session' },
              { value: 'reunion', label: 'Alumni Reunion' },
            ]}
          />

          <Select
            id="locationType"
            label="Location Type"
            value={locationType}
            onChange={(e) => setLocationType(e.target.value as EventLocationType)}
            options={[
              { value: 'virtual', label: 'Virtual (Online Link)' },
              { value: 'in_person', label: 'In-Person (Campus / Venue)' },
              { value: 'hybrid', label: 'Hybrid' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="startDate"
            type="datetime-local"
            label="Start Date & Time"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />

          <Input
            id="endDate"
            type="datetime-local"
            label="End Date & Time"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        <Input
          id="venueOrLink"
          label={locationType === 'virtual' ? 'Meeting URL (Zoom, Meet, Teams)' : 'Physical Venue Address'}
          placeholder={
            locationType === 'virtual'
              ? 'https://meet.google.com/xyz-abc'
              : 'Campus Engineering Auditorium, Hall B'
          }
          leftIcon={locationType === 'virtual' ? <LinkIcon className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
          value={venueOrLink}
          onChange={(e) => setVenueOrLink(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="capacity"
            type="number"
            min="1"
            label="Max Capacity (Optional)"
            placeholder="Unlimited if left empty"
            leftIcon={<Users className="w-4 h-4" />}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />

          <Input
            id="bannerUrl"
            type="url"
            label="Banner Image URL (Optional)"
            placeholder="https://images.unsplash.com/..."
            leftIcon={<ImageIcon className="w-4 h-4" />}
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
          />
        </div>

        <Textarea
          id="eventDescription"
          label="Event Agenda & Description"
          placeholder="Outline the session takeaways, target audience, and prerequisites..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          required
        />

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
            {userRole === 'admin' ? 'Publish Event' : 'Submit Event'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
