import React, { useState } from 'react';

const SearchBox = ({ 
  placeholder = "Buscar...", 
  onSearch, 
  disabled = false,
  className = "form-control",
  buttonText = "Buscar",
  icon = "fas fa-search"
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = () => {
    if (searchTerm.trim() && onSearch) {
      onSearch(searchTerm.trim());
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="input-group">
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={disabled}
      />
      <button 
        className="btn btn-primary"
        onClick={handleSearch}
        disabled={disabled || !searchTerm.trim()}
      >
        <i className={`${icon} me-1`}></i>{buttonText}
      </button>
    </div>
  );
};

export default SearchBox;