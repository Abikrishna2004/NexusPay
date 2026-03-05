import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CustomDropdown({ options, value, onChange, placeholder, icon: Icon, required }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="custom-dropdown-container" ref={dropdownRef}>
            <div
                className={`custom-dropdown-header ${isOpen ? 'open' : ''} ${!value && required ? 'required-empty' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="custom-dropdown-header-content">
                    {Icon && <Icon size={18} className="dropdown-icon" />}
                    <span style={{ color: selectedOption ? '#fff' : 'var(--text-muted)' }}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown size={18} className={`dropdown-arrow ${isOpen ? 'open' : ''}`} />
            </div>

            {/* Hidden native select for standard HTML5 validation if needed */}
            <select
                className="sr-only"
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none', top: '50%', left: '50%' }}
                value={value}
                onChange={() => { }}
                required={required}
            >
                <option value=""></option>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>

            {isOpen && (
                <div className="custom-dropdown-list animate-fade-in-fast">
                    {options.map((option) => (
                        <div
                            key={option.value}
                            className={`custom-dropdown-item ${value === option.value ? 'selected' : ''}`}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
