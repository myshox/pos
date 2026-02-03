import React, { useState } from 'react';

// 模擬一些商品資料
const PRODUCTS = [
  { id: 1, name: '招牌紅茶', price: 30, category: '飲料' },
  { id: 2, name: '珍珠奶茶', price: 50, category: '飲料' },
  { id: 3, name: '脆皮雞排', price: 80, category: '炸物' },
  { id: 4, name: '黃金薯條', price: 45, category: '炸物' },
  { id: 5, name: '拿鐵咖啡', price: 120, category: '咖啡' },
];

function App() {
  const [cart, setCart] = useState([]);

  // 加入購物車功能
  const addToCart = (product) => {
    const existingItem = cart.find((item) => item.id === product.id);
    if (existingItem) {
      setCart(cart.map((item) =>
        item.id === product.id ? { ...item, qty: item.qty + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  // 刪除購物車項目
  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  // 計算總金額
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="flex h-screen bg-gray-100 p-4 gap-4">
      {/* 左邊：商品區 */}
      <div className="w-2/3 bg-white rounded-xl shadow-lg p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">點餐區</h1>
        <div className="grid grid-cols-3 gap-4">
          {PRODUCTS.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="h-32 bg-blue-50 border-2 border-blue-100 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition flex flex-col items-center justify-center p-4"
            >
              <span className="text-xl font-bold text-gray-700">{product.name}</span>
              <span className="text-blue-600 font-bold mt-2">${product.price}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 右邊：結帳區 */}
      <div className="w-1/3 bg-white rounded-xl shadow-lg p-6 flex flex-col">
        <h2 className="text-2xl font-bold mb-4 border-b pb-2 text-gray-800">購物車</h2>
        
        <div className="flex-1 overflow-y-auto space-y-3">
          {cart.length === 0 ? (
            <p className="text-gray-400 text-center mt-10">尚未選擇商品</p>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                <div>
                  <div className="font-bold">{item.name}</div>
                  <div className="text-sm text-gray-500">${item.price} x {item.qty}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg">${item.price * item.qty}</span>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    移除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xl text-gray-600">總計</span>
            <span className="text-3xl font-bold text-blue-600">${total}</span>
          </div>
          <button 
            className="w-full bg-green-500 hover:bg-green-600 text-white text-xl font-bold py-4 rounded-lg shadow transition transform active:scale-95"
            onClick={() => alert(`結帳完成！總金額：$${total}`)}
          >
            結帳 (Charge)
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;