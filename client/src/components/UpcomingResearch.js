import React from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { cn } from '../libs/utils';

const researchData = [
  {
    id: '1',
    title: 'Quantum Solution Market Option',
    description: 'For: Client Demo, Quantum Solution',
    priority: 'high'
  },
  {
    id: '2',
    title: 'Quantum Solution Market Option',
    description: 'For: Client Demo, Quantum Solution',
    priority: 'high'
  },
  {
    id: '3',
    title: 'Q2 Performance Metrics',
    description: 'For: 1-on-1 With Director',
    priority: 'medium'
  }
];

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.3
    }
  })
};

const UpcomingResearch = () => {
  return (
    <motion.div 
      className="card p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Search size={18} />
        Research For Upcoming Meeting
      </h2>
      
      <div className="mt-3 space-y-3">
        {researchData.map((item, index) => (
          <motion.div
            key={item.id}
            className="relative flex items-center justify-between p-3 rounded-lg hover:bg-[#EFF6FF] transition-colors border border-[#BFDBFE]"
            custom={index}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.01 }}
          >
            <div>
              <p className="font-medium text-[#1e293b]">{item.title}</p>
              <p className="text-sm text-[#475569]">{item.description}</p>
            </div>
            
            <div className={cn(`badge-${item.priority}`, "badge")}>
              {item.priority === 'high' ? '⬆' : item.priority === 'medium' ? '⬌' : '⬇'} {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default UpcomingResearch;