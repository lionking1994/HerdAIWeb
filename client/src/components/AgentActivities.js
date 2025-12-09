import React from 'react';
import { motion } from 'framer-motion';
import { ActivitySquare } from 'lucide-react';
import { cn, getStatusColor } from '../libs/utils';


const activityData = [
  {
    id: '1',
    title: 'Sales Pipeline Analysis',
    type: 'Data Agent',
    status: 'Need Review',
    date: 'May 5'
  },
  {
    id: '2',
    title: 'Email Response drafts',
    type: 'Content Agent',
    status: 'Reviewed',
    date: 'May 6'
  },
  {
    id: '3',
    title: 'Sales Pipeline Analysis',
    type: 'Data Agent',
    status: 'Need Review',
    date: 'May 5'
  },
  {
    id: '4',
    title: 'Email Response drafts',
    type: 'Content Agent',
    status: 'Reviewed',
    date: 'May 6'
  },
  {
    id: '5',
    title: 'Email Response drafts',
    type: 'Content Agent',
    status: 'Reviewed',
    date: 'May 6'
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

const AgentActivities = () => {
  return (
    <motion.div 
      className="card p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <ActivitySquare size={18} />
        Agent Activities
      </h2>
      
      <div className="mt-3 space-y-3">
        {activityData.map((item, index) => {
          const statusColor = getStatusColor(item.status);
          const needsReview = item.status === 'Need Review';
          
          return (
            <motion.div
              key={item.id}
              className="relative flex items-center justify-between p-2 rounded-lg hover:bg-[#f8fafc] transition-colors"
              custom={index}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.01 }}
            >
              <div>
                <p className="font-medium text-[#1e293b]">{item.title}</p>
                <p className="text-sm text-[#64748b]">{item.type} · {item.date}</p>
              </div>
              
              <div className={cn(`badge-${statusColor?.toLowerCase()}`, "badge flex items-center")}>
                {needsReview ? '⚠️' : '✓'} {item.status}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default AgentActivities;