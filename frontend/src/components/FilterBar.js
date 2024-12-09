import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './FilterBar.css';

function FilterBar({
  startDate,
  endDate,
  sortOrder,
  onStartDateChange,
  onEndDateChange,
  onSortOrderChange,
}) {
  const handleFilterChange = (filterType) => {
    const now = new Date();
    let newStartDate = null;
    let newEndDate = null;

    if (filterType === 'lastHour') {
      newEndDate = now;
      newStartDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    } else if (filterType === 'today') {
      newStartDate = new Date(now.setHours(0, 0, 0, 0)); // Start of today
      newEndDate = new Date(); // Current time
    } else if (filterType === 'yesterday') {
      newEndDate = new Date(now.setHours(0, 0, 0, 0)); // Start of today
      newStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Start of yesterday
    } else if (filterType === 'allTime') {
      newStartDate = null; // Clear the date filters
      newEndDate = null;
    }

    // Notify parent about the date range change
    onStartDateChange(newStartDate); // Can be null for "All Time"
    onEndDateChange(newEndDate); // Can be null for "All Time"
  };

  return (
    <div className="filter-bar">
      {/* Dropdowns Group */}
      <div className="dropdown-group">
        <select
          onChange={(e) => handleFilterChange(e.target.value)}
          defaultValue="allTime" // Default to "All Time"
          className="filter-dropdown"
        >
          <option value="allTime">All Time</option>
          <option value="lastHour">Last Hour</option>
          <option value="yesterday">Yesterday</option>
          <option value="today">Today</option>
        </select>

        <select
          onChange={(e) => onSortOrderChange(e.target.value)}
          value={sortOrder || 'desc'}
          className="sort-order-dropdown"
        >
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
      </div>

      {/* Date Picker Group */}
      <div className="date-picker-group">
        <DatePicker
          selected={startDate}
          onChange={(date) => onStartDateChange(date)}
          placeholderText="Start Date"
          dateFormat="yyyy-MM-dd"
          className="date-picker-input"
        />
        <DatePicker
          selected={endDate}
          onChange={(date) => onEndDateChange(date)}
          placeholderText="End Date"
          dateFormat="yyyy-MM-dd"
          className="date-picker-input"
        />
      </div>
    </div>
  );
}

export default FilterBar;
