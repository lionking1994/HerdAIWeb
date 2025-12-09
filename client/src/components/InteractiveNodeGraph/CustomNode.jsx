import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Edit3 } from 'lucide-react';

const CustomNode = memo(({ data, id }) => {
  const getNodeSize = () => {
    const width = Math.min(200, Math.max(120, data.label.length * 8));
    return {
      width: `${width}px`,
      height: data.group === 'central_theme' ? '80px' : '60px'
    };
  };

  const getNodeStyle = () => {
    const baseStyle = {
      background: data.color,
      border: `2px solid ${data.color}`,
      borderRadius: '12px',
      padding: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      ...getNodeSize()
    };

    if (data.group === 'central_theme') {
      return {
        ...baseStyle,
        fontSize: '14px',
        fontWeight: '600',
        boxShadow: '0 6px 20px rgba(255, 165, 0, 0.3)',
        transform: 'scale(1.1)'
      };
    }

    return {
      ...baseStyle,
      fontSize: '12px',
      fontWeight: '500'
    };
  };

  return (
    <div className="custom-node" style={getNodeStyle()}>
      <Handle type="target" position={Position.Top} style={{ background: '#555', width: '8px', height: '8px' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#555', width: '8px', height: '8px' }} />
      <div style={{ color: 'black', textAlign: 'center', lineHeight: '1.2', wordWrap: 'break-word', maxWidth: '100%' }}>
        {data.label}
      </div>
      <button onClick={(e) => { e.stopPropagation(); data.onAnnotationClick(id); }} style={{
        position: 'absolute', top: '4px', right: '4px', background: 'rgba(255, 255, 255, 0.8)', border: 'none',
        borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer', opacity: data.annotation ? 1 : 0.6
      }}>
        <Edit3 size={10} color="#666" />
      </button>
      {data.annotation && (
        <div style={{
          position: 'absolute', bottom: '-30px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.8)', color: 'white', padding: '4px 8px', borderRadius: '4px',
          fontSize: '10px', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>{data.annotation}</div>
      )}
    </div>
  );
});

export default CustomNode;