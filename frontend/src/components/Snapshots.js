import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  getPaginatedSnapshots,
  addToBlacklist,
  sendEmailWithItem,
  downloadSnapshot,
} from '../services/api';
import FilterBar from './FilterBar';
import Loader from './Loader';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Snapshots.css';

const FullscreenModal = memo(({ imagePath, onClose, fullscreenSnapshotId }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [blacklistName, setBlacklistName] = useState('');
  const [isBlacklistFormVisible, setIsBlacklistFormVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [isEmailFormVisible, setIsEmailFormVisible] = useState(false);

  const fetchImage = async (path) => {
    const imageUrl = `${process.env.REACT_APP_API_BASE_URL}/${path}`;
    console.log('Fetching snapshot image from:', imageUrl);
    try {
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'Ngrok-Skip-Browser-Warning': 'true',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error while fetching image! status: ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setImageSrc(objectUrl);
    } catch (err) {
      console.error('Error fetching snapshot image:', err.message);
      toast.error('Failed to load snapshot image.');
    }
  };

  useEffect(() => {
    if (imagePath) {
      fetchImage(imagePath);
    }
  }, [imagePath]);

  const handleAddToBlacklist = useCallback(async () => {
    if (!blacklistName.trim()) {
      toast.error('Blacklist name cannot be empty.');
      return;
    }
    try {
      await addToBlacklist({ snapshotId: fullscreenSnapshotId, name: blacklistName.trim() });
      toast.success('Added to blacklist successfully!');
      setIsBlacklistFormVisible(false);
      setBlacklistName('');
    } catch (err) {
      console.error('Error adding to blacklist:', err);
      toast.error(err.message || 'Failed to add to blacklist.');
    }
  }, [blacklistName, fullscreenSnapshotId]);

  const handleEmailSubmit = useCallback(async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    try {
      setIsEmailFormVisible(false);
      await sendEmailWithItem('snapshot', fullscreenSnapshotId, email.trim());
      toast.success('Email sent successfully!');
      setEmail('');
    } catch (err) {
      console.error('Error sending email:', err);
      toast.error('Failed to send email. Please try again.');
    }
  }, [email, fullscreenSnapshotId]);

  const handleDownload = useCallback(async () => {
    try {
      const response = await downloadSnapshot('snapshot', fullscreenSnapshotId);
      const blob = response.data;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `snapshot_${fullscreenSnapshotId}.jpg`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Download started.');
    } catch (err) {
      console.error('Error downloading snapshot:', err);
      toast.error('Failed to download snapshot.');
    }
  }, [fullscreenSnapshotId]);

  return (
    <div className="fullscreen-modal" onClick={onClose}>
      <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
        {imageSrc ? (
          <img src={imageSrc} alt="Fullscreen snapshot" className="fullscreen-image" />
        ) : (
          <Loader />
        )}
        <div className="fullscreen-actions">
          <button
            onClick={() => {
              setIsBlacklistFormVisible(true);
              setIsEmailFormVisible(false);
            }}
          >
            Add to Blacklist
          </button>
          <button
            onClick={() => {
              setIsEmailFormVisible(true);
              setIsBlacklistFormVisible(false);
            }}
          >
            Send via Email
          </button>
          <button onClick={handleDownload}>Download</button>
        </div>

        {isBlacklistFormVisible && (
          <div className="email-form">
            <input
              type="text"
              value={blacklistName}
              onChange={(e) => setBlacklistName(e.target.value)}
              placeholder="Enter blacklist name"
            />
            <button onClick={handleAddToBlacklist}>Add</button>
          </div>
        )}

        {isEmailFormVisible && (
          <div className="email-form">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
            <button onClick={handleEmailSubmit}>Send</button>
          </div>
        )}
      </div>
    </div>
  );
});

FullscreenModal.displayName = 'FullscreenModal';

const SnapshotItem = ({ snapshot, onImageClick }) => {
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
    if (snapshot.image_path) {
      fetchImageForGrid(snapshot.image_path);
    }
  }, [snapshot.image_path]);

  return (
    <div key={snapshot.id} className="snapshot-item">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={`Snapshot taken on ${snapshot.timestamp}`}
          onClick={() => {
            onImageClick(snapshot.image_path, snapshot.id);
          }}
        />
      ) : (
        <Loader />
      )}
      <p>{snapshot.timestamp}</p>
    </div>
  );
};

function Snapshots() {
  const [snapshots, setSnapshots] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [blacklisted, setBlacklisted] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullscreenImagePath, setFullscreenImagePath] = useState(null);
  const [fullscreenSnapshotId, setFullscreenSnapshotId] = useState(null);

  const fetchSnapshots = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit: 25,
        blacklisted,
        sort: sortOrder,
        start_date: startDate ? startDate.toISOString().split('T')[0] : undefined,
        end_date: endDate ? endDate.toISOString().split('T')[0] : undefined,
      };
      const response = await getPaginatedSnapshots(params);
      setSnapshots(response.data.items || []);
      setTotalPages(response.data.pages || 1);
    } catch (err) {
      console.error('Error fetching snapshots:', err);
      setSnapshots([]);
      setError('Failed to fetch snapshots. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, [page, blacklisted, sortOrder, startDate, endDate]);

  const handleImageClick = (imagePath, id) => {
    setFullscreenImagePath(imagePath);
    setFullscreenSnapshotId(id);
  };

  return (
    <div className="snapshots">
      <h1>Snapshots</h1>
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
        {snapshots.map((snapshot) => (
          <SnapshotItem
            key={snapshot.id}
            snapshot={snapshot}
            onImageClick={handleImageClick}
          />
        ))}
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
        <FullscreenModal
          imagePath={fullscreenImagePath}
          fullscreenSnapshotId={fullscreenSnapshotId}
          onClose={() => {
            setFullscreenImagePath(null);
            setFullscreenSnapshotId(null);
          }}
        />
      )}

      <ToastContainer />
    </div>
  );
}

export default Snapshots;
