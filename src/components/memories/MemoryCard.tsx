import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Memory } from '../../store/slices/memoriesSlice';
import './MemoryCard.css';

interface MemoryCardProps {
  memory: Memory;
  compact?: boolean;
  preview?: boolean;
  onClick?: () => void;
  distance?: number;
}

const MemoryCard: React.FC<MemoryCardProps> = ({
  memory,
  compact = false,
  preview = false,
  onClick,
  distance,
}) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/memories/${memory.id}`);
    }
  };
  
  const formatDate = (date?: Date) => {
    if (!date) return 'No date';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  const formatDistance = (meters?: number) => {
    if (!meters) return '';
    if (meters < 1000) {
      return `${Math.round(meters)} m away`;
    }
    return `${(meters / 1000).toFixed(1)} km away`;
  };
  
  const thumbnailUrl = memory.media.length > 0 
    ? memory.media[0].url 
    : '/images/default-memory.jpg';
  
  if (compact) {
    return (
      <div className="memory-card memory-card-compact" onClick={handleClick}>
        <div 
          className="memory-card-thumbnail" 
          style={{ backgroundImage: `url(${thumbnailUrl})` }}
        >
          {memory.isPrivate && (
            <div className="memory-privacy-badge">
              <i className="fas fa-lock"></i>
            </div>
          )}
        </div>
        <div className="memory-card-content">
          <h3 className="memory-card-title">{memory.title}</h3>
          <p className="memory-card-location">{memory.location.address}</p>
          {distance !== undefined && (
            <p className="memory-card-distance">{formatDistance(distance)}</p>
          )}
        </div>
      </div>
    );
  }
  
  if (preview) {
    return (
      <div className="memory-card memory-card-preview" onClick={handleClick}>
        <div 
          className="memory-card-thumbnail" 
          style={{ backgroundImage: `url(${thumbnailUrl})` }}
        >
          {memory.isPrivate && (
            <div className="memory-privacy-badge">
              <i className="fas fa-lock"></i>
            </div>
          )}
          {distance !== undefined && (
            <div className="memory-distance-badge">
              {formatDistance(distance)}
            </div>
          )}
        </div>
        <div className="memory-card-content">
          <h3 className="memory-card-title">{memory.title}</h3>
          <p className="memory-card-excerpt">{
            memory.description.length > 60
              ? `${memory.description.substring(0, 60)}...`
              : memory.description
          }</p>
        </div>
        <div className="memory-preview-cta">
          <span>View Memory</span>
          <i className="fas fa-arrow-right"></i>
        </div>
      </div>
    );
  }
  
  return (
    <div className="memory-card" onClick={handleClick}>
      <div 
        className="memory-card-thumbnail" 
        style={{ backgroundImage: `url(${thumbnailUrl})` }}
      >
        {memory.isPrivate && (
          <div className="memory-privacy-badge">
            <i className="fas fa-lock"></i>
          </div>
        )}
        {distance !== undefined && (
          <div className="memory-distance-badge">
            {formatDistance(distance)}
          </div>
        )}
      </div>
      <div className="memory-card-content">
        <div className="memory-card-header">
          <h3 className="memory-card-title">{memory.title}</h3>
          <div className="memory-card-date">{formatDate(memory.date)}</div>
        </div>
        <p className="memory-card-location">{memory.location.address}</p>
        <p className="memory-card-excerpt">{
          memory.description.length > 120
            ? `${memory.description.substring(0, 120)}...`
            : memory.description
        }</p>
        <div className="memory-card-tags">
          {memory.tags.slice(0, 3).map(tag => (
            <span key={tag.id} className="memory-tag">
              {tag.name}
            </span>
          ))}
          {memory.tags.length > 3 && (
            <span className="memory-tag memory-tag-more">
              +{memory.tags.length - 3}
            </span>
          )}
        </div>
        <div className="memory-card-importance">
          {Array.from({ length: 5 }).map((_, index) => (
            <i 
              key={index}
              className={`fas fa-star ${index < memory.importance ? 'active' : ''}`}
            ></i>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MemoryCard;