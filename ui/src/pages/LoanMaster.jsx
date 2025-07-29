import React, { useEffect, useState } from 'react';
import { useRole } from '../lib/roles';

export default function LoanMaster() {
  const role = useRole();
  const isAdmin = role === 'admin';
  const [search, setSearch] = useState('');
  const [borrower, setBorrower] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setBorrower({
        name: 'Jane Doe',
        dob: '1990-01-01',
        address: '123 Main St, NY',
        phone: '555-1234',
        ssn: '***-**-1234',
        entity: 'Doe LLC'
      });
    }, 300);
    return () => clearTimeout(t);
  }, []);

  const handleChange = e => {
    setBorrower({ ...borrower, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    setEditing(false);
    // TODO: persist changes via API
  };

  if (!borrower) return <p>Loading...</p>;

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search borrower"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="border p-1 rounded w-full text-black"
      />
      <div className="bg-white text-black p-4 rounded shadow relative text-sm space-y-1">
        {editing ? (
          <>
            <input
              name="name"
              value={borrower.name}
              onChange={handleChange}
              className="border p-1 w-full mb-1"
            />
            <input
              name="dob"
              value={borrower.dob}
              onChange={handleChange}
              className="border p-1 w-full mb-1"
            />
            <input
              name="address"
              value={borrower.address}
              onChange={handleChange}
              className="border p-1 w-full mb-1"
            />
            <input
              name="phone"
              value={borrower.phone}
              onChange={handleChange}
              className="border p-1 w-full mb-1"
            />
            <input
              name="ssn"
              value={borrower.ssn}
              onChange={handleChange}
              className="border p-1 w-full mb-1"
            />
            <input
              name="entity"
              value={borrower.entity}
              onChange={handleChange}
              className="border p-1 w-full mb-1"
            />
            <button
              onClick={handleSave}
              className="mt-2 px-2 py-1 bg-blue-600 text-white rounded text-xs"
            >
              Save
            </button>
          </>
        ) : (
          <>
            <p>Name: {borrower.name}</p>
            <p>DOB: {borrower.dob}</p>
            <p>Address: {borrower.address}</p>
            <p>Phone: {borrower.phone}</p>
            <p>SSN: {borrower.ssn}</p>
            <p>Entity Name: {borrower.entity}</p>
            {isAdmin && (
              <button
                onClick={() => setEditing(true)}
                className="absolute top-2 right-2 text-blue-600 text-xs"
              >
                Edit
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
