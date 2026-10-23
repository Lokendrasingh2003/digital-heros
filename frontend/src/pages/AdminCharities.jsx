
import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { API_URL, authHeaders } from "../api";
import { getToken } from "../utils/auth";

const emptyForm = {
  name: "",
  description: "",
  category: "",
  website_url: "",
  image_url: "",
  is_featured: false,
  is_active: true,
};

export default function AdminCharities() {
  const token = getToken();

  const [charities, setCharities] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [events, setEvents] = useState([]);
  const [eventForm, setEventForm] = useState({
    charityId: "",
    title: "",
    description: "",
    eventDate: "",
    imageUrl: "",
  });

  async function loadCharities() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/admin/charities`, {
        headers: authHeaders(token),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to load charities.");
      }

      setCharities(result.charities || []);
    } catch (err) {
      setError(err.message || "Unable to load charities.");
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    const response = await fetch(`${API_URL}/admin/charities/events`, {
      headers: authHeaders(token),
    });
    const result = await response.json();
    if (response.ok) setEvents(result.events || []);
  }

  useEffect(() => {
    loadCharities();
    loadEvents();
  }, []);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/admin/charities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token, true),
        },
        body: JSON.stringify({
          ...form,
          website_url: form.website_url.trim() || null,
          image_url: form.image_url.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to create charity.");
      }

      setForm(emptyForm);
      setMessage("Charity created successfully.");
      await loadCharities();
    } catch (err) {
      setError(err.message || "Unable to create charity.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(charity) {
    setError("");
    setMessage("");
    setUpdatingId(charity.id);

    try {
      const response = await fetch(
        `${API_URL}/admin/charities/${charity.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(token, true),
          },
          body: JSON.stringify({ is_active: !charity.is_active }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to update charity.");
      }

      setCharities((previous) =>
        previous.map((item) =>
          item.id === charity.id ? result.charity : item
        )
      );

      setMessage(
        `${charity.name} is now ${result.charity.is_active ? "active" : "inactive"}.`
      );
    } catch (err) {
      setError(err.message || "Unable to update charity.");
    } finally {
      setUpdatingId("");
    }
  }

  
async function handleEdit(charity) {
  const name = window.prompt("Charity name:", charity.name);
  if (name === null) return;

  if (!name.trim()) {
    setError("Charity name cannot be empty.");
    return;
  }

  const description = window.prompt(
    "Description:",
    charity.description || ""
  );
  if (description === null) return;

  const category = window.prompt(
    "Category:",
    charity.category || ""
  );
  if (category === null) return;

  const websiteUrl = window.prompt(
    "Website URL (leave blank for none):",
    charity.website_url || ""
  );
  if (websiteUrl === null) return;

  setError("");
  setMessage("");
  setEditingId(charity.id);

  try {
    const response = await fetch(
      `${API_URL}/admin/charities/${charity.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token, true),
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          website_url: websiteUrl.trim() || null,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Unable to update charity.");
    }

    setCharities((previous) =>
      previous.map((item) =>
        item.id === charity.id ? result.charity : item
      )
    );

    setMessage("Charity updated successfully.");
  } catch (err) {
    setError(err.message || "Unable to update charity.");
  } finally {
    setEditingId("");
  }
}


  async function deleteCharity(charity) {
    if (!window.confirm(`Delete ${charity.name}?`)) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/admin/charities/${charity.id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to delete charity.");
      setMessage(result.message);
      await loadCharities();
      await loadEvents();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createEvent(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/admin/charities/${eventForm.charityId}/events`,
        {
          method: "POST",
          headers: authHeaders(token, true),
          body: JSON.stringify({
            title: eventForm.title,
            description: eventForm.description,
            eventDate: eventForm.eventDate
              ? new Date(eventForm.eventDate).toISOString()
              : null,
            imageUrl: eventForm.imageUrl || null,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to create event.");
      setEventForm({
        charityId: "",
        title: "",
        description: "",
        eventDate: "",
        imageUrl: "",
      });
      setMessage("Event created.");
      await loadEvents();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteEvent(eventId) {
    const response = await fetch(`${API_URL}/admin/charities/events/${eventId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "Unable to delete event.");
      return;
    }
    setEvents((current) => current.filter((item) => item.id !== eventId));
  }

  return (
    <main className="charities-page">
      <section className="charities-header">
        <h1>Charity Management</h1>
        <p>Create charity listings and manage their visibility.</p>
      </section>

      <section className="dashboard-card">
        <h2>Add a Charity</h2>

        <form onSubmit={handleCreate} className="admin-charity-form">
          <label>
            Charity name *
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              maxLength={150}
              placeholder="e.g. Green Future Foundation"
            />
          </label>

          <label>
            Description
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Describe the charity's work"
            />
          </label>

          <label>
            Category
            <input
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="e.g. Environment"
            />
          </label>

          <label>
            Website URL
            <input
              name="website_url"
              type="url"
              value={form.website_url}
              onChange={handleChange}
              placeholder="https://example.org"
            />
          </label>

          <label>
            Image URL
            <input
              name="image_url"
              type="url"
              value={form.image_url}
              onChange={handleChange}
              placeholder="https://example.org/image.jpg"
            />
          </label>

          <label className="admin-checkbox">
            <input
              type="checkbox"
              name="is_featured"
              checked={form.is_featured}
              onChange={handleChange}
            />
            Feature this charity
          </label>

          <label className="admin-checkbox">
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={handleChange}
            />
            Make this charity active
          </label>

          <button type="submit" disabled={saving}>
            <Plus size={16} />
            {saving ? "Creating..." : "Create Charity"}
          </button>
        </form>
      </section>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <section className="admin-charity-list">
        <div className="admin-list-header">
          <h2>All Charities ({charities.length})</h2>
          <button type="button" onClick={loadCharities} disabled={loading}>
            <RefreshCw size={16} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading && <p>Loading charities...</p>}

        {!loading && charities.length === 0 && (
          <p>No charities found. Add your first charity above.</p>
        )}

        <div className="charities-grid">
          {charities.map((charity) => (
            <article className="charity-card" key={charity.id}>
              {charity.image_url && (
                <img
                  className="charity-image"
                  src={charity.image_url}
                  alt={charity.name}
                />
              )}

              <div className="charity-card-content">
                {charity.is_featured && (
                  <span className="featured-label">Featured</span>
                )}

                <h3>{charity.name}</h3>
                <p>{charity.description || "No description provided."}</p>
                <p>Category: {charity.category || "Uncategorized"}</p>
                <p>
                  Status: <strong>{charity.is_active ? "Active" : "Inactive"}</strong>
                </p>

                <button
  type="button"
  disabled={editingId === charity.id}
  onClick={() => handleEdit(charity)}
>
  {editingId === charity.id ? "Saving..." : "Edit Details"}
</button>

                <button type="button" onClick={() => deleteCharity(charity)}>
                  Delete
                </button>

                <button
                  type="button"
                  disabled={updatingId === charity.id}
                  onClick={() => toggleActive(charity)}
                >
                  {updatingId === charity.id
                    ? "Updating..."
                    : charity.is_active
                      ? "Deactivate"
                      : "Activate"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-card">
        <h2>Charity events</h2>
        <form onSubmit={createEvent} className="admin-charity-form">
          <label>
            Charity
            <select
              value={eventForm.charityId}
              onChange={(event) =>
                setEventForm((current) => ({
                  ...current,
                  charityId: event.target.value,
                }))
              }
              required
            >
              <option value="">Select a charity</option>
              {charities.map((charity) => (
                <option key={charity.id} value={charity.id}>
                  {charity.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              value={eventForm.title}
              onChange={(event) =>
                setEventForm((current) => ({ ...current, title: event.target.value }))
              }
              required
            />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={eventForm.description}
              onChange={(event) =>
                setEventForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Date
            <input
              type="datetime-local"
              value={eventForm.eventDate}
              onChange={(event) =>
                setEventForm((current) => ({
                  ...current,
                  eventDate: event.target.value,
                }))
              }
            />
          </label>
          <button type="submit">Add event</button>
        </form>

        {events.length === 0 ? (
          <p>No events yet.</p>
        ) : (
          <ul className="clean-list">
            {events.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                {" · "}
                {charities.find((charity) => charity.id === item.charity_id)?.name ||
                  "Charity"}
                <button type="button" className="text-button" onClick={() => deleteEvent(item.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
