import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import FilterBar from './FilterBar'; // Import the reusable FilterBar component
import './Dashboard.css';
import Loader from './Loader'; // Ensure Loader.js is properly imported

function Dashboard() {
  const [data, setData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [startDate, setStartDate] = useState(null); // Default to "All Time"
  const [endDate, setEndDate] = useState(null); // Default to "All Time"
  const [imageSrc, setImageSrc] = useState(null); // State for the snapshot image
  const [error, setError] = useState(null);

  // Base API URL from environment variable
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  const fetchDashboardData = async () => {
    const dashboardUrl = `${baseUrl}/api/dashboard`;
    console.log('Fetching dashboard data from:', dashboardUrl);

    try {
      const response = await fetch(dashboardUrl, {
        method: 'GET',
        headers: {
          'Ngrok-Skip-Browser-Warning': 'true',
          Accept: 'application/json',
        },
      });

      console.log('Dashboard response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Dashboard data received:', result);

      setData(result);

      // Fetch the snapshot image if available
      if (result.last_snapshot_image) {
        fetchSnapshotImage(result.last_snapshot_image);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err.message);
      setError(err.message);
    }
  };

  const fetchSnapshotStats = async () => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
    if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
  
    const statsUrl = `${baseUrl}/api/snapshots/stats?${params.toString() || ''}`;
    console.log('Fetching snapshot stats from:', statsUrl);
  
    try {
      const response = await fetch(statsUrl, {
        method: 'GET',
        headers: {
          'Ngrok-Skip-Browser-Warning': 'true',
          Accept: 'application/json',
        },
      });
  
      console.log('Snapshot stats response status:', response.status);
  
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
      const stats = await response.json();
      console.log('Snapshot stats received:', stats);
  
      setChartData(stats);
    } catch (err) {
      console.error('Error fetching snapshot stats:', err.message);
      setError(err.message);
    }
  };
  

  const fetchSnapshotImage = async (imagePath) => {
    const imageUrl = `${baseUrl}/${imagePath}`;
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

      const blob = await response.blob(); // Convert response to blob
      const objectUrl = URL.createObjectURL(blob); // Create a URL for the image
      setImageSrc(objectUrl); // Set the image source
    } catch (err) {
      console.error('Error fetching snapshot image:', err.message);
      setError('Failed to load snapshot image');
    }
  };

  useEffect(() => {
    console.log('Base API URL:', baseUrl); // Log the base URL for debugging purposes
    fetchDashboardData();
    fetchSnapshotStats(); // Fetch "All Time" data by default
  }, [baseUrl]);

  useEffect(() => {
    console.log('Fetching snapshot stats with updated dates:', { startDate, endDate });
    fetchSnapshotStats();
  }, [startDate, endDate]);
  

  if (error) {
    console.error('Rendering error message:', error);
    return <div className="error">Error: {error}</div>;
  }

  if (!data) {
    console.log('Dashboard data not loaded yet. Showing loading indicator.');
    return <Loader />;
  }

  console.log('Rendering dashboard with data:', data);

  return (
    <div className="dashboard">
      <div className="header">
        <h1>Main Dashboard</h1>
      </div>

      <div className="stats">
        {[{
          title: 'Camera Status',
          value: data.camera_status ? 'Connected' : 'Disconnected',
          status: data.camera_status,
        },
        { title: 'Camera IP', value: data.camera_ip },
        { title: 'Total Snapshots', value: data.total_snapshots },
        { title: 'Blacklist Size', value: data.blacklist_size },
        ].map((card, index) => (
          <div className="card" key={index}>
            <h3>{card.title}</h3>
            <p
              className={`value ${
                card.title === 'Camera Status'
                  ? card.status
                    ? 'connected'
                    : 'disconnected'
                  : ''
              }`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="snapshot-section">
        <h2>Last Snapshot</h2>
        {imageSrc === null ? (
          <Loader />
        ) : imageSrc ? (
          <>
            <img
              src={imageSrc}
              alt="Last Snapshot"
              className="snapshot"
              onLoad={() => console.log('Last snapshot image loaded successfully.')}
              onError={(err) => console.error('Error displaying last snapshot image:', err)}
            />
            <p>Last Snapshot Time: {data.last_snapshot_time || 'Not available'}</p>
          </>
        ) : (
          <p>No snapshot available</p>
        )}
      </div>

      <div className="graph-section">
        <h2>Snapshot Activity Over Time</h2>
        <FilterBar
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={(date) => {
            console.log('Start date updated:', date);
            setStartDate(date);
          }}
          onEndDateChange={(date) => {
            console.log('End date updated:', date);
            setEndDate(date);
          }}
          sortOrder={null}
          onSortOrderChange={() => {}} // Optional: Provide a no-op function if not needed
        />
        {chartData.length === 0 ? (
          error ? (
            <p className="error">Error: {error}</p>
          ) : (
            <p>No data available for the selected range.</p>
          )
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey="count"
                fill="#003366"
                barSize={Math.max(10, 100 / (chartData.length || 1))}
                onClick={(data, index) => console.log('Bar clicked:', { data, index })}
              />
            </BarChart>
          </ResponsiveContainer>
        )}

      </div>
    </div>
  );
}

export default Dashboard;
