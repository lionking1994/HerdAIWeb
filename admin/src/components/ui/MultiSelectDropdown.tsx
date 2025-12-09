
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import clsx from "clsx";

type OptionType = {
  label: string;
  value: string;
};

type GroupedOption = {
  label: string;
  options: OptionType[];
};

type Props = {
  label?: string;
  options: GroupedOption[];
  value: string[];
  onChange: (values: string[]) => void;
};

export default function MultiSelectDropdown({
  label = "Select",
  options,
  value,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleValue = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const filteredOptions = options
    .map((group) => ({
      ...group,
      options: group.options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((group) => group.options.length > 0);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 text-left border border-gray-300 bg-white rounded-md shadow-sm flex justify-between items-center hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500"
      >
        <span className="truncate text-sm text-gray-700">
          {value.length > 0
            ? options
                .flatMap((g) => g.options)
                .filter((opt) => value.includes(opt.value))
                .map((opt) => opt.label)
                .join(", ")
            : label}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1">
          <input
            type="text"
            placeholder="Search..."
            className="w-full px-3 py-2 border-b border-gray-200 focus:outline-none text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {filteredOptions.map((group) => (
            <div key={group.label} className="p-2">
              <div className="text-xs text-gray-500 font-medium mb-1 px-2">
                {group.label}
              </div>
              {group.options.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => toggleValue(opt.value)}
                  className={clsx(
                    "flex items-center justify-between px-3 py-2 rounded cursor-pointer hover:bg-indigo-50",
                    value.includes(opt.value) && "bg-indigo-50"
                  )}
                >
                  <span className="text-sm text-gray-800">{opt.label}</span>
                  {value.includes(opt.value) && (
                    <Check className="w-4 h-4 text-indigo-600" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
