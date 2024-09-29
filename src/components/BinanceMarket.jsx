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
      console.log(`Received WebSocket data for ${symbol}:`, message); // Debug WebSocket messages
      const candlestick = message.k;

      if (candlestick.x) {
        const newCandlestick = {
          time: candlestick.t / 1000, // Time should be in seconds for the chart
          open: parseFloat(candlestick.o),
          high: parseFloat(candlestick.h),
          low: parseFloat(candlestick.l),
          close: parseFloat(candlestick.c),
        };

        // Store new data in the cache for the current symbol
        if (!dataCache.current[symbol]) {
          dataCache.current[symbol] = [];
        }
        
        // Check if the time already exists to avoid duplicates
        const existingIndex = dataCache.current[symbol].findIndex(item => item.time === newCandlestick.time);
        if (existingIndex === -1) {
          dataCache.current[symbol].push(newCandlestick);
          
          // Sort data to ensure ascending order by time
          dataCache.current[symbol].sort((a, b) => a.time - b.time);

          // Persist cache to localStorage
          storeDataToLocalStorage();
        }

        // Log the data before setting it
        console.log('Setting chart data:', dataCache.current[symbol]);

        // Update chart with new data, ensuring it's sorted
        const sortedData = [...dataCache.current[symbol]].sort((a, b) => a.time - b.time);
        candlestickSeriesRef.current.setData(sortedData);
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
    // Initialize chart on first render
    if (chartContainerRef.current && !chartRef.current) {
      chartRef.current = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        layout: {
          backgroundColor: '#ffffff',
          textColor: '#000',
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

    // Reset the chart and load cached data when the symbol changes
    resetChart();

    // Check if we have cached data for the current symbol
    if (dataCache.current[symbol]) {
      console.log(`Loading cached data for ${symbol}`);
      
      // Log the cached data before setting it
      console.log('Cached data:', dataCache.current[symbol]);

      // Sort cached data before setting it
      const sortedData = [...dataCache.current[symbol]].sort((a, b) => a.time - b.time);
      
      // Check for duplicates before setting data
      const uniqueSortedData = sortedData.filter((item, index, self) =>
        index === self.findIndex((t) => (t.time === item.time))
      );

      console.log('Unique sorted data:', uniqueSortedData);
      candlestickSeriesRef.current.setData(uniqueSortedData);
    }

    // Start WebSocket connection
    connectWebSocket();

    // Cleanup WebSocket on unmount or symbol/interval change
    return () => {
      if (socketRef.current && isConnected.current) {
        socketRef.current.close();
        console.log(`WebSocket connection closing for ${symbol}`);
      }
    };
  }, [symbol, interval]); // Reconnect WebSocket when symbol or interval changes

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
    <div className="flex flex-col items-center p-4">
      <h1 className="text-2xl font-bold mb-4">Binance Market Data</h1> {/* Heading added here */}
      <div className="mb-4">
        <select onChange={(e) => setSymbol(e.target.value)} className="mr-4 p-2 border rounded">
          <option value="ethusdt">ETH/USDT</option>
          <option value="bnbusdt">BNB/USDT</option>
          <option value="dotusdt">DOT/USDT</option>
        </select>

        <select onChange={(e) => setInterval(e.target.value)} className="p-2 border rounded">
          <option value="1m">1 Minute</option>
          <option value="3m">3 Minute</option>
          <option value="5m">5 Minute</option>
        </select>
      </div>

      <div
        ref={chartContainerRef}
        style={{
          width: '80vw',  // 80% of the viewport width
          height: '80vh', // 80% of the viewport height
          border: '1px solid #ccc',
        }}
      />
    </div>
  );
};

export default BinanceMarketData;
