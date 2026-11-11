async function getProducts() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/products`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

export default async function Home() {
  const products = await getProducts();

  if (!products || products.length === 0) {
    return <div className="text-center mt-20 text-stone-500">Menu hiện đang trống.</div>;
  }

  return (
    <main className="min-h-screen pb-10 max-w-md mx-auto md:max-w-4xl px-4">
      {/* Header với hiệu ứng đổ bóng nhẹ */}
      <header className="pt-10 pb-6 text-center">
        <div className="inline-block bg-amber-100 text-amber-800 p-3 rounded-full mb-3 shadow-sm">
          <span className="text-3xl">☕</span>
        </div>
        <h1 className="text-3xl font-extrabold text-stone-800 tracking-tight">BrewLite</h1>
        <p className="text-sm text-stone-500 mt-1 font-medium">Đặt cà phê không dùng tiền mặt</p>
      </header>
      
      {/* Lưới sản phẩm */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((product: any) => (
          <div 
            key={product.id} 
            className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100 flex gap-4 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group"
          >
            {/* Khung ảnh */}
            <div className="w-28 h-28 flex-shrink-0 bg-stone-100 rounded-xl overflow-hidden relative">
              {product.imageUrl && (
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                />
              )}
            </div>
            
            {/* Thông tin sản phẩm */}
            <div className="flex flex-col justify-between flex-grow py-1">
              <div>
                <h2 className="text-lg font-bold text-stone-800 truncate">{product.name}</h2>
                <p className="text-amber-600 font-extrabold text-lg mt-1">
                  {Number(product.basePrice).toLocaleString('vi-VN')} đ
                </p>
              </div>
              
              {/* Trạng thái và Nút thêm */}
              <div className="flex items-center justify-between mt-2">
                {product.stock > 0 ? (
                  <span className="text-[11px] font-bold px-2.5 py-1 bg-green-50 text-green-600 rounded-md border border-green-100">
                    Còn {product.stock}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-1 bg-red-50 text-red-600 rounded-md border border-red-100">
                    Hết hàng
                  </span>
                )}
                
                {/* Nút thêm vào giỏ (Giao diện chuẩn bị cho Task 5) */}
                <button className="bg-amber-100 text-amber-700 w-8 h-8 rounded-full flex items-center justify-center font-bold hover:bg-amber-600 hover:text-white transition-colors">
                  +
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}