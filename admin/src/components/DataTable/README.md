# Enhanced Data Table Component

This component provides a standardized table implementation for the HERD application with the following features:

- Consistent styling using the HERD Blue and Gray color scheme
- Sortable columns (enabled by default for all columns)
- Pagination for tables with more than 30 records
- Alternating row colors for better readability
- Hover effects using HERD Blue
- Support for both client-side and server-side pagination

## Usage

```tsx
import { EnhancedDataTable } from '../components/DataTable';
import { ColumnDef } from '@tanstack/react-table';

// Define your columns
const columns: ColumnDef<YourDataType>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
  },
  {
    accessorKey: 'name',
    header: 'Name',
  },
  // Add more columns as needed
];

// Your component
function YourComponent() {
  const [data, setData] = useState<YourDataType[]>([]);
  
  return (
    <EnhancedDataTable
      columns={columns}
      data={data}
      pageSize={30} // Optional, defaults to 30
      showPagination={true} // Optional, defaults to true
    />
  );
}
```

## Server-side Pagination

For server-side pagination, use the following props:

```tsx
<EnhancedDataTable
  columns={columns}
  data={data}
  manualPagination={true}
  pageCount={totalPages}
  onPaginationChange={(pagination) => {
    // Fetch data for the new page
    fetchData(pagination.pageIndex + 1, pagination.pageSize);
  }}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| columns | ColumnDef<TData, TValue>[] | required | Column definitions |
| data | TData[] | required | Table data |
| pageSize | number | 30 | Number of rows per page |
| showPagination | boolean | true | Whether to show pagination controls |
| manualPagination | boolean | false | Whether pagination is handled manually (server-side) |
| pageCount | number | undefined | Total number of pages (for server-side pagination) |
| onPaginationChange | function | undefined | Callback when pagination changes |

## Styling

The table uses the HERD Blue and Gray color scheme:

- Blue Primary: #007bff
- Blue Hover: #0056b3
- Blue Light: #e6f2ff
- Gray Primary: #666666
- Gray Light: #f5f5f5
- Gray Border: #e0e0e0
- Gray Dark: #333333

These colors are used consistently across the table for headers, rows, borders, and interactive elements.

