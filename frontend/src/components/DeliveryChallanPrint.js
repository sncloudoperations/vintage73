export default function DeliveryChallanPrint({ data }) {
  const { challan, company } = data || {};

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (!challan || !company) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8 bg-white text-black text-sm" style={{ fontFamily: 'Arial, sans-serif', width: '210mm', minHeight: '297mm' }}>
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-4 mb-4">
        <h1 className="text-2xl font-bold uppercase">{company.companyName}</h1>
        <p className="text-sm">{company.address}, {company.city}, {company.state} - {company.pincode}</p>
        <p className="text-sm">Phone: {company.phone} | Email: {company.email}</p>
        <p className="text-sm font-semibold">GSTIN: {company.registrationNumber}</p>
      </div>

      {/* Title */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold border border-black inline-block px-6 py-1">DELIVERY CHALLAN</h2>
      </div>

      {/* Challan Details */}
      <div className="grid grid-cols-2 gap-4 mb-4 border border-black p-3">
        <div>
          <p><strong>Challan No:</strong> {challan.challanNumber}</p>
          <p><strong>Challan Date:</strong> {formatDate(challan.challanDate)}</p>
          <p><strong>Reason for Movement:</strong> {challan.reasonForMovement}</p>
        </div>
        <div className="text-right">
          {challan.ewayBillNumber && <p><strong>E-Way Bill No:</strong> {challan.ewayBillNumber}</p>}
          {challan.vehicleNumber && <p><strong>Vehicle No:</strong> {challan.vehicleNumber}</p>}
          {challan.transportMode && <p><strong>Transport Mode:</strong> {challan.transportMode}</p>}
        </div>
      </div>

      {/* Dispatch Details */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-black p-3">
          <h3 className="font-bold border-b border-black mb-2 pb-1">Dispatch From:</h3>
          <p className="font-semibold">{company.companyName}</p>
          <p>{challan.dispatchFrom || company.address}</p>
          <p>{company.city}, {company.state} - {company.pincode}</p>
        </div>
        <div className="border border-black p-3">
          <h3 className="font-bold border-b border-black mb-2 pb-1">Dispatch To:</h3>
          {challan.customer ? (
            <>
              <p className="font-semibold">{challan.customer.name}</p>
              <p>{challan.dispatchTo || challan.customer.address}</p>
              <p>{challan.customer.city}, {challan.customer.state} - {challan.customer.pincode}</p>
              {challan.customer.gstin && <p><strong>GSTIN:</strong> {challan.customer.gstin}</p>}
            </>
          ) : (
            <p>{challan.dispatchTo || 'Internal Movement'}</p>
          )}
        </div>
      </div>

      {/* Transporter Details */}
      {(challan.transporterName || challan.transporterId) && (
        <div className="border border-black p-3 mb-4">
          <h3 className="font-bold border-b border-black mb-2 pb-1">Transporter Details:</h3>
          <div className="grid grid-cols-3 gap-4">
            {challan.transporterName && <p><strong>Name:</strong> {challan.transporterName}</p>}
            {challan.transporterId && <p><strong>GSTIN:</strong> {challan.transporterId}</p>}
            {challan.vehicleNumber && <p><strong>Vehicle No:</strong> {challan.vehicleNumber}</p>}
          </div>
        </div>
      )}

      {/* Items Table */}
      <table className="w-full border-collapse mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-2 text-left w-12">SN</th>
            <th className="border border-black p-2 text-left">Description of Goods</th>
            <th className="border border-black p-2 text-center w-24">HSN Code</th>
            <th className="border border-black p-2 text-center w-24">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {challan.items?.map((item, idx) => (
            <tr key={item.id}>
              <td className="border border-black p-2">{idx + 1}</td>
              <td className="border border-black p-2">
                {item.product?.name}
                {item.description && <span className="text-gray-600"> - {item.description}</span>}
              </td>
              <td className="border border-black p-2 text-center">{item.hsnCode || item.product?.hsnCode || '-'}</td>
              <td className="border border-black p-2 text-center">{item.quantity}</td>
            </tr>
          ))}
          {/* Empty rows for manual entry */}
          {[...Array(Math.max(0, 5 - (challan.items?.length || 0)))].map((_, idx) => (
            <tr key={`empty-${idx}`}>
              <td className="border border-black p-2 h-8">&nbsp;</td>
              <td className="border border-black p-2">&nbsp;</td>
              <td className="border border-black p-2">&nbsp;</td>
              <td className="border border-black p-2">&nbsp;</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100">
            <td colSpan="3" className="border border-black p-2 text-right font-bold">Total Quantity:</td>
            <td className="border border-black p-2 text-center font-bold">
              {challan.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Notes */}
      <div className="border border-black p-3 mb-8">
        <h4 className="font-bold mb-2">Notes:</h4>
        <p className="text-xs text-gray-600">
          1. This challan is issued for the movement of goods as per the reason mentioned above.<br />
          2. The goods mentioned above are being sent without consideration (no sale).<br />
          3. E-Way Bill may be required if value exceeds threshold limit.
        </p>
      </div>

      {/* Signature */}
      <div className="flex justify-between mt-16">
        <div className="text-center">
          <div className="border-t border-black pt-2 w-48">Receiver's Signature</div>
          <p className="text-xs text-gray-500 mt-1">with Date & Stamp</p>
        </div>
        <div className="text-center">
          <p className="font-semibold mb-12">For {company.companyName}</p>
          <div className="border-t border-black pt-2 w-48">Authorized Signatory</div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-500 border-t border-gray-300 pt-2">
        This is a computer-generated document and does not require a signature when digitally signed.
      </div>
    </div>
  );
}
