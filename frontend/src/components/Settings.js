import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/api';
import './Settings.css'; 

const Settings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await getSettings();
      setSettings(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to load settings. Please try again.');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    try {
      await updateSettings(settings);
      setSuccess('Settings updated successfully.');
    } catch (err) {
      console.error('Error updating settings:', err);
      setError('Failed to update settings. Please try again.');
    }
  };

  if (loading) return <div className="loading">Loading settings...</div>;

  return (
    <div className="settings-container">
      <h1>Settings</h1>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {/* Form Container */}
      <form onSubmit={handleSubmit}>
        <div className="form-container">
          <div className="form-group">
            <label htmlFor="camera_ip">Camera IP:</label>
            <input
              type="text"
              id="camera_ip"
              name="camera_ip"
              value={settings.camera_ip || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="camera_password">Camera Password:</label>
            <input
              type="password"
              id="camera_password"
              name="camera_password"
              value={settings.camera_password || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email_notifications">Email Notifications:</label>
            <select
              id="email_notifications"
              name="email_notifications"
              value={settings.email_notifications || 'false'}
              onChange={handleChange}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="snapshot_retention_days">Snapshot Retention Days:</label>
            <input
              type="number"
              id="snapshot_retention_days"
              name="snapshot_retention_days"
              value={settings.snapshot_retention_days || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="smtp_server">SMTP Server:</label>
            <input
              type="text"
              id="smtp_server"
              name="smtp_server"
              value={settings.smtp_server || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="smtp_port">SMTP Port:</label>
            <input
              type="number"
              id="smtp_port"
              name="smtp_port"
              value={settings.smtp_port || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="smtp_username">SMTP Username:</label>
            <input
              type="text"
              id="smtp_username"
              name="smtp_username"
              value={settings.smtp_username || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="smtp_password">SMTP Password:</label>
            <input
              type="password"
              id="smtp_password"
              name="smtp_password"
              value={settings.smtp_password || ''}
              onChange={handleChange}
            />
          </div>

          {/* Submit Button */}
          <div className="form-submit">
            <button type="submit" className="submit-button">
              Save Settings
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Settings;
