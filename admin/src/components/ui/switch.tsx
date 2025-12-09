import React, { forwardRef } from "react";
import "./switch.css";

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(event.target.checked);
      }
    };

    return (
      <label className={`switch-container ${className || ""}`}>
        <input
          type="checkbox"
          className="switch-input"
          checked={checked}
          onChange={handleChange}
          ref={ref}
          {...props}
        />
        <span className="switch-slider"></span>
      </label>
    );
  }
);

Switch.displayName = "Switch";

export { Switch };
