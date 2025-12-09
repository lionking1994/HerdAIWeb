// export const staticGraphData = {
//   visualization: {
//     style: {
//       nodeTextColor: "#333333",
//       nodeTextPosition: "inside",
//       cleanProfessional: true,
//       responsive: true
//     },
//     nodes: [
//       // People (Purple)
//       {
//         id: "matt_francis",
//         label: "Matt Francis",
//         group: "person",
//         color: "#8B5CF6"
//       },
//       {
//         id: "ken_cranney",
//         label: "Ken Cranney",
//         group: "person",
//         color: "#8B5CF6"
//       },
//       {
//         id: "bill_larkin",
//         label: "Bill Larkin",
//         group: "person",
//         color: "#8B5CF6"
//       },
//       // Companies (Blue)
//       {
//         id: "ibm",
//         label: "IBM",
//         group: "company",
//         color: "#3B82F6"
//       },
//       {
//         id: "salesforce",
//         label: "Salesforce",
//         group: "company",
//         color: "#3B82F6"
//       },
//       {
//         id: "capgemini",
//         label: "Capgemini",
//         group: "company",
//         color: "#3B82F6"
//       },
//       {
//         id: "get_heard",
//         label: "Get Heard",
//         group: "company",
//         color: "#3B82F6"
//       },
//       {
//         id: "executive_alliance",
//         label: "Executive Alliance",
//         group: "company",
//         color: "#3B82F6"
//       },
//       {
//         id: "sikich",
//         label: "Sikich",
//         group: "company",
//         color: "#3B82F6"
//       },
//       // Central Theme (Orange)
//       {
//         id: "workforce_transformation",
//         label: "Workforce Transformation & Adoption",
//         group: "central_theme",
//         color: "#F97316"
//       },
//       // Sales Opportunities (Green)
//       {
//         id: "implementation_opportunity",
//         label: "Implementation & Change Management Opportunity",
//         group: "opportunity",
//         color: "#10B981"
//       }
//     ],
//     edges: [
//       // Matt Francis connections
//       {
//         from: "matt_francis",
//         to: "ibm",
//         label: "previous CTQ, innovation experience",
//         thickness: 2
//       },
//       {
//         from: "matt_francis",
//         to: "salesforce",
//         label: "previous experience, ecosystem",
//         thickness: 2
//       },
//       {
//         from: "matt_francis",
//         to: "capgemini",
//         label: "ran $200M practice",
//         thickness: 3
//       },
//       {
//         from: "matt_francis",
//         to: "capgemini",
//         label: "founder",
//         thickness: 3
//       },
//       // Capgemini connections
//       {
//         from: "capgemini",
//         to: "workforce_transformation",
//         label: "drives product vision, addresses inefficiency",
//         thickness: 3
//       },
//       {
//         from: "capgemini",
//         to: "get_heard",
//         label: "platform for transformation",
//         thickness: 2
//       },
//       // Workforce Transformation connections
//       {
//         from: "workforce_transformation",
//         to: "executive_alliance",
//         label: "drives transformation, adoption, efficiency",
//         thickness: 3
//       },
//       {
//         from: "workforce_transformation",
//         to: "implementation_opportunity",
//         label: "enables sales opportunity",
//         thickness: 3
//       },
//       // Ken Cranney connections
//       {
//         from: "ken_cranney",
//         to: "executive_alliance",
//         label: "previously worked",
//         thickness: 2
//       },
//       {
//         from: "ken_cranney",
//         to: "sikich",
//         label: "company acquired",
//         thickness: 2
//       },
//       // Sikich connections
//       {
//         from: "sikich",
//         to: "implementation_opportunity",
//         label: "consulting partnership",
//         thickness: 2
//       },
//       // Bill Larkin connections
//       {
//         from: "bill_larkin",
//         to: "implementation_opportunity",
//         label: "implementation planning & next steps",
//         thickness: 2
//       },
//       // Get Heard connections
//       {
//         from: "get_heard",
//         to: "implementation_opportunity",
//         label: "business development, implementation need",
//         thickness: 2
//       }
//     ]
//   }
// }; 



// Sample meeting transcript data
 export const staticGraphData = {
  visualization: {
    style: {
      nodeTextColor: "black",
      nodeTextPosition: "inside",
      cleanProfessional: true,
      responsive: true
    },
    nodes: [
      {
        id: "central_theme",
        label: "Workforce Transformation & Adoption",
        color: "#fb923c",
        group: "central_theme"
      },
      {
        id: "ken_cranney",
        label: "Ken Cranney",
        group: "person",
        color: "#a855f7"
      },
      {
        id: "matt_francis",
        label: "Matt Francis",
        group: "person",
        color: "#a855f7"
      },
      {
        id: "bill_larkin",
        label: "Bill Larkin",
        group: "person",
        color: "#a855f7"
      },
      {
        id: "company_executive_alliance",
        label: "Executive Alliance",
        group: "company",
        color: "#3b82f6"
      },
      {
        id: "company_sikich",
        label: "Sikich",
        group: "company",
        color: "#3b82f6"
      },
      {
        id: "company_ibm",
        label: "IBM",
        group: "company",
        color: "#3b82f6"
      },
      {
        id: "company_salesforce",
        label: "Salesforce",
        group: "company",
        color: "#3b82f6"
      },
      {
        id: "company_capgemini",
        label: "Capgemini",
        group: "company",
        color: "#3b82f6"
      },
      {
        id: "company_get_heard",
        label: "Get Heard",
        group: "company",
        color: "#3b82f6"
      },
      {
        id: "sales_opportunity",
        label: "Implementation & Change Management Opportunity",
        group: "opportunity",
        color: "#22c55e"
      }
    ],
    edges: [
      {
        from: "ken_cranney",
        to: "central_theme",
        label: "drives transformation, adoption, efficiency",
        thickness: 2
      },
      {
        from: "matt_francis",
        to: "central_theme",
        label: "drives product vision, addresses inefficiency",
        thickness: 2
      },
      {
        from: "bill_larkin",
        to: "central_theme",
        label: "aligns implementation, supports planning",
        thickness: 2
      },
      {
        from: "ken_cranney",
        to: "company_executive_alliance",
        label: "previously worked",
        thickness: 1
      },
      {
        from: "ken_cranney",
        to: "company_sikich",
        label: "company acquired",
        thickness: 1
      },
      {
        from: "matt_francis",
        to: "company_ibm",
        label: "previous CTO, innovation experience",
        thickness: 1
      },
      {
        from: "matt_francis",
        to: "company_salesforce",
        label: "previous experience, ecosystem",
        thickness: 1
      },
      {
        from: "matt_francis",
        to: "company_capgemini",
        label: "ran $200M practice",
        thickness: 1
      },
      {
        from: "matt_francis",
        to: "company_get_heard",
        label: "founder, creates solution",
        thickness: 2
      },
      {
        from: "central_theme",
        to: "company_get_heard",
        label: "platform for transformation",
        thickness: 3
      },
      {
        from: "company_get_heard",
        to: "sales_opportunity",
        label: "business development, implementation need",
        thickness: 3
      },
      {
        from: "central_theme",
        to: "sales_opportunity",
        label: "enables sales opportunity",
        thickness: 2
      },
      {
        from: "ken_cranney",
        to: "sales_opportunity",
        label: "consulting partnership",
        thickness: 2
      },
      {
        from: "bill_larkin",
        to: "sales_opportunity",
        label: "implementation planning & next steps",
        thickness: 2
      }
    ]
  }
};

 