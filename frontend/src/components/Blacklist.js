import React, { useState, useEffect, useCallback } from 'react';
import {
  getPaginatedBlacklist,
  sendEmailWithItem,
  downloadSnapshot as downloadBlacklist,
  removeFromBlacklist,
} from '../services/api';
import FilterBar from './FilterBar';
import Loader from './Loader'; // Ensure Loader.js is properly set up
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Snapshots.css';

const BlacklistItem = ({ entry, onImageClick }) => {
  const [imageSrc, setImageSrc] = useState(null);

  const fetchImageForGrid = async (imagePath) => {
    const imageUrl = `${process.env.REACT_APP_API_BASE_URL}/${imagePath}`;
    try {
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'Ngrok-Skip-Browser-Warning': 'true',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error while fetching image: ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setImageSrc(objectUrl);
    } catch (err) {
      console.error(`Error fetching image ${imagePath}:`, err.message);
    }
  };

  useEffect(() => {
    if (entry.image_path) {
      fetchImageForGrid(entry.image_path);
    }
  }, [entry.image_path]);

  return (
    <div className="snapshot-item">
        <p className="snapshot-name">{entry.name || 'No Name Available'}</p> {/* Fallback text */}
        {imageSrc ? (
            <img
                src={imageSrc}
                alt="Blacklist entry"
                onClick={() => onImageClick(entry.image_path, entry.id)}
            />
        ) : (
            <Loader />
        )}
        <p>{entry.timestamp}</p>
    </div>

  );
};

function Blacklist() {
  const [blacklist, setBlacklist] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortOrder, setSortOrder] = useState('desc');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fullscreen modal states
  const [fullscreenImagePath, setFullscreenImagePath] = useState(null);
  const [fullscreenImageSrc, setFullscreenImageSrc] = useState(null);
  const [fullscreenBlacklistId, setFullscreenBlacklistId] = useState(null);

  // Email states
  const [email, setEmail] = useState('');
  const [isEmailFormVisible, setIsEmailFormVisible] = useState(false);

  const fetchBlacklist = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit: 25,
        sort: sortOrder,
        start_date: startDate ? startDate.toISOString().split('T')[0] : undefined,
        end_date: endDate ? endDate.toISOString().split('T')[0] : undefined,
      };
      const response = await getPaginatedBlacklist(params);
      setBlacklist(response.data.items || []);
      setTotalPages(response.data.pages || 1);
    } catch (err) {
      console.error('Error fetching blacklist:', err);
      setBlacklist([]);
      setError('Failed to fetch blacklist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlacklist();
    // The effect will run whenever these dependencies change, which includes the initial render
  }, [page, sortOrder, startDate, endDate]);

  const handleImageClick = (imagePath, id) => {
    setFullscreenImagePath(imagePath);
    setFullscreenBlacklistId(id);
    setFullscreenImageSrc(null); // reset fullscreen image source
    setIsEmailFormVisible(false);
  };

  const fetchFullscreenImage = async (path) => {
    const imageUrl = `${process.env.REACT_APP_API_BASE_URL}/${path}`;
    try {
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'Ngrok-Skip-Browser-Warning': 'true',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error while fetching fullscreen image: ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setFullscreenImageSrc(objectUrl);
    } catch (err) {
      console.error(`Error fetching fullscreen image ${path}:`, err.message);
      toast.error('Failed to load image.');
    }
  };

  useEffect(() => {
    if (fullscreenImagePath) {
      fetchFullscreenImage(fullscreenImagePath);
    }
  }, [fullscreenImagePath]);

  const handleDownload = useCallback(async () => {
    try {
      const response = await downloadBlacklist('blacklist', fullscreenBlacklistId);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `blacklist_${fullscreenBlacklistId}.jpg`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Download started.');
    } catch (err) {
      console.error('Error downloading blacklist entry:', err);
      toast.error('Failed to download blacklist entry.');
    }
  }, [fullscreenBlacklistId]);

  const handleEmailSubmit = useCallback(async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    try {
      setIsEmailFormVisible(false);
      await sendEmailWithItem('blacklist', fullscreenBlacklistId, email.trim());
      toast.success('Email sent successfully!');
      setEmail('');
    } catch (err) {
      console.error('Error sending email:', err);
      toast.error('Failed to send email. Please try again.');
    }
  }, [email, fullscreenBlacklistId]);

  const handleRemoveFromBlacklist = useCallback(() => {
    const toastId = toast.error(
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 'bold' }}>
          Are you sure you want to remove this entry from the blacklist?
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            marginTop: '10px',
          }}
        >
          <button
            style={{
              padding: '10px 20px',
              backgroundColor: 'green',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
            onClick={async () => {
              try {
                toast.dismiss(toastId);
                await removeFromBlacklist(fullscreenBlacklistId);
                toast.success('Removed from blacklist successfully.');
                fetchBlacklist();
                setFullscreenImagePath(null);
                setFullscreenBlacklistId(null);
              } catch (err) {
                console.error('Error removing from blacklist:', err);
                toast.error(err.message || 'Failed to remove from blacklist.');
              }
            }}
          >
            Yes
          </button>
          <button
            style={{
              padding: '10px 20px',
              backgroundColor: 'red',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
            onClick={() => toast.dismiss(toastId)}
          >
            No
          </button>
        </div>
      </div>,
      { autoClose: false }
    );
  }, [fullscreenBlacklistId, fetchBlacklist]);

  return (
    <div className="snapshots">
      <h1>Blacklist</h1>
      <FilterBar
        startDate={startDate}
        endDate={endDate}
        sortOrder={sortOrder}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onSortOrderChange={setSortOrder}
      />

      {error && <p className="error">{error}</p>}
      {loading && <Loader />}

      <div className="snapshot-grid">
        {blacklist.length > 0 ? (
          blacklist.map((entry) => (
            <BlacklistItem
              key={entry.id}
              entry={entry}
              onImageClick={handleImageClick}
            />
          ))
        ) : (
          <p>No blacklist entries available for the selected criteria.</p>
        )}
      </div>

      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage((prev) => prev - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button disabled={page === totalPages} onClick={() => setPage((prev) => prev + 1)}>
          Next
        </button>
      </div>

      {fullscreenImagePath && (
        <div
          className="fullscreen-modal"
          onClick={() => {
            setFullscreenImagePath(null);
            setFullscreenBlacklistId(null);
            setIsEmailFormVisible(false);
          }}
        >
          <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
            {fullscreenImageSrc ? (
              <img
                src={fullscreenImageSrc}
                alt="Fullscreen blacklist entry"
                className="fullscreen-image"
              />
            ) : (
              <Loader />
            )}
            <div className="fullscreen-actions">
              <button onClick={handleDownload}>Download</button>
              <button onClick={() => setIsEmailFormVisible(true)}>Send via Email</button>
              <button onClick={handleRemoveFromBlacklist}>Remove from Blacklist</button>
            </div>
            {isEmailFormVisible && (
              <div className="email-form">
                <label>
                  
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@example.com"
                  />
                </label>
                <button onClick={handleEmailSubmit}>Send Email</button>
              </div>
            )}
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}

export default Blacklist;
