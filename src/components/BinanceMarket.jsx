import { useEffect, useState, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const BinanceMarketData = () => {
  const [symbol, setSymbol] = useState('ethusdt');
  const [interval, setInterval] = useState('1m');
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const socketRef = useRef(null);
  const isConnected = useRef(false);

  // In-memory object to cache candlestick data for each symbol
  const dataCache = useRef({});
  const pendingData = useRef([]); // To temporarily hold incoming data

  // Load data from localStorage when component is mounted
  useEffect(() => {
    const storedData = localStorage.getItem('chartData');
    if (storedData) {
      dataCache.current = JSON.parse(storedData);
      console.log('Loaded data from localStorage:', dataCache.current);
    }
  }, []);

  // Function to store the current cache to localStorage
  const storeDataToLocalStorage = () => {
    localStorage.setItem('chartData', JSON.stringify(dataCache.current));
  };

  // Function to reset chart when switching symbols
  const resetChart = () => {
    if (candlestickSeriesRef.current) {
      chartRef.current.removeSeries(candlestickSeriesRef.current);
    }
    candlestickSeriesRef.current = chartRef.current.addCandlestickSeries();
  };

  const connectWebSocket = () => {
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      console.log(`WebSocket connection opened for ${symbol}`);
      isConnected.current = true;
    };

    socketRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const candlestick = message.k;

      if (candlestick.x) {
        const newCandlestick = {
          time: candlestick.t / 1000,
          open: parseFloat(candlestick.o),
          high: parseFloat(candlestick.h),
          low: parseFloat(candlestick.l),
          close: parseFloat(candlestick.c),
        };

        // Store new data in the cache for the current symbol
        if (!dataCache.current[symbol]) {
          dataCache.current[symbol] = [];
        }

        const existingIndex = dataCache.current[symbol].findIndex(item => item.time === newCandlestick.time);
        if (existingIndex === -1) {
          dataCache.current[symbol].push(newCandlestick);
          dataCache.current[symbol].sort((a, b) => a.time - b.time);
          storeDataToLocalStorage();

          // Push new data to pendingData array for batch update
          pendingData.current.push(newCandlestick);
        }
      }
    };

    socketRef.current.onclose = () => {
      console.log(`WebSocket connection closed for ${symbol}`);
      isConnected.current = false;
    };

    socketRef.current.onerror = (error) => {
      console.error(`WebSocket error for ${symbol}:`, error);
      isConnected.current = false;
    };
  };

  useEffect(() => {
    if (chartContainerRef.current && !chartRef.current) {
      chartRef.current = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        layout: {
          backgroundColor: '#000000', // Set chart background color to black
          textColor: '#ffffff', // Change text color to white for visibility
        },
        grid: {
          vertLines: {
            color: '#e1e1e1',
          },
          horzLines: {
            color: '#e1e1e1',
          },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });
      candlestickSeriesRef.current = chartRef.current.addCandlestickSeries();
    }

    resetChart();

    if (dataCache.current[symbol]) {
      const sortedData = [...dataCache.current[symbol]].sort((a, b) => a.time - b.time);
      const uniqueSortedData = sortedData.filter((item, index, self) =>
        index === self.findIndex((t) => (t.time === item.time))
      );
      candlestickSeriesRef.current.setData(uniqueSortedData);
    }

    connectWebSocket();

    return () => {
      if (socketRef.current && isConnected.current) {
        socketRef.current.close();
        console.log(`WebSocket connection closing for ${symbol}`);
      }
    };
  }, [symbol, interval]);

  // Effect to periodically update the chart with pending data
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (pendingData.current.length > 0) {
        candlestickSeriesRef.current.setData([...dataCache.current[symbol], ...pendingData.current]);
        pendingData.current = []; // Clear pending data after update
      }
    }, 1000); // Update every second

    return () => clearInterval(intervalId);
  }, [symbol]);

  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="flex flex-col items-center p-4 bg-black min-h-screen"> {/* Set background to black */}
      <h1 className="text-2xl font-bold mb-4 text-white text-center">Binance Market Data</h1> {/* Set text color to white */}
      <div className="mb-4 flex flex-col sm:flex-row justify-center">
        <select onChange={(e) => setSymbol(e.target.value)} className="mr-4 p-2 border rounded bg-gray-800 text-white"> {/* Dark background and light text */}
          <option value="ethusdt">ETH/USDT</option>
          <option value="bnbusdt">BNB/USDT</option>
          <option value="dotusdt">DOT/USDT</option>
        </select>

        <select onChange={(e) => setInterval(e.target.value)} className="p-2 border rounded bg-gray-800 text-white"> {/* Dark background and light text */}
          <option value="1m">1 Minute</option>
          <option value="3m">3 Minute</option>
          <option value="5m">5 Minute</option>
        </select>
      </div>

      <div
        ref={chartContainerRef}
        className="w-full max-w-screen-lg" // Set max width for larger screens
        style={{
          height: '80vh', // 80% of the viewport height
          border: '1px solid #ccc',
        }}
      />
    </div>
  );
};

export default BinanceMarketData;
