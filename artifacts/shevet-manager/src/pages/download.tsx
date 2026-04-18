const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export function DownloadPage() {
  const handleDownload = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/download-codebase`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "full-codebase.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      alert("שגיאה בהורדה");
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00327d] to-[#001a42]">
      <div className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-md w-full mx-4">
        <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-[#00327d] text-4xl">download</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#00327d] mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
          הורדת קוד המערכת
        </h1>
        <p className="text-slate-500 text-sm mb-8">קובץ טקסט אחד עם כל קוד המקור של האתר (101 קבצים)</p>
        <button
          onClick={handleDownload}
          className="w-full py-4 bg-[#00327d] hover:bg-[#002060] text-white font-bold text-lg rounded-2xl transition-all shadow-lg shadow-[#00327d]/20 active:scale-[0.98]"
        >
          הורד קובץ קוד מלא
        </button>
        <p className="text-xs text-slate-400 mt-4">full-codebase.txt · ~860KB</p>
      </div>
    </div>
  );
}
