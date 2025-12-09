import React, { memo } from 'react';
import { getBezierPath, BaseEdge, EdgeLabelRenderer } from 'reactflow';
import { Edit3 } from 'lucide-react';

const CustomEdge = memo(({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) => {
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition
  });

  const strokeWidth = Math.max(1, (data?.thickness || 1) * 2);

  return (
    <>
      <BaseEdge 
        id={id} 
        path={edgePath} 
        style={{ 
          strokeWidth, 
          stroke: '#64748b', 
          strokeDasharray: data?.annotation ? '5,5' : 'none',
          zIndex: 1,
          pointerEvents: 'all'
        }} 
      />
      <EdgeLabelRenderer>
        <div style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          background: 'rgba(255, 255, 255, 0.95)', padding: '4px 8px', borderRadius: '6px',
          fontSize: '10px', fontWeight: '500', color: '#374151', border: '1px solid #e5e7eb',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', maxWidth: '150px', textAlign: 'center',
          lineHeight: '1.2', pointerEvents: 'all', cursor: 'pointer'
        }} onClick={() => data?.onAnnotationClick(id)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>{data?.label}</span>
            <Edit3 size={8} color="#666" opacity={data?.annotation ? 1 : 0.6} />
          </div>
          {data?.annotation && (
            <div style={{ marginTop: '2px', fontSize: '8px', color: '#6b7280', fontStyle: 'italic' }}>
              {data.annotation}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

export default CustomEdge;
