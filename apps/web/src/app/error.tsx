'use client';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-4 text-center">
      <h2 className="text-xl font-bold text-red-600 mb-2">Đã có lỗi xảy ra!</h2>
      <p className="text-stone-500 mb-4">Không thể tải menu lúc này.</p>
      <button onClick={() => reset()} className="px-4 py-2 bg-amber-600 text-white rounded-lg">
        Thử lại
      </button>
    </div>
  );
}