import React, { useEffect, useState } from 'react';
import { Video, Users, Calendar, MessageSquare, BarChart as ChartBar } from 'lucide-react';

const icons = [Video, Users, Calendar, MessageSquare, ChartBar];

interface FloatingIconProps {
  Icon: React.ElementType;
  delay: number;
  size: number;
  position: { x: number; y: number };
}

const FloatingIcon: React.FC<FloatingIconProps> = ({ Icon, delay, size, position }) => {
  return (
    <div
      className="absolute floating-icon"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        animationDelay: `${delay}s`,
      }}
    >
      <Icon size={size} />
    </div>
  );
};

export const FloatingIcons = () => {
  const [iconProps, setIconProps] = useState<Array<{
    id: number;
    delay: number;
    size: number;
    position: { x: number; y: number };
  }>>([]);

  useEffect(() => {
    const props = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      delay: Math.random() * 2,
      size: 20 + Math.random() * 30,
      position: {
        x: Math.random() * 100,
        y: Math.random() * 100,
      },
    }));
    setIconProps(props);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {iconProps.map((prop) => (
        <FloatingIcon
          key={prop.id}
          Icon={icons[prop.id % icons.length]}
          delay={prop.delay}
          size={prop.size}
          position={prop.position}
        />
      ))}
    </div>
  );
};