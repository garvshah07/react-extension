import React from 'react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import './App.css'
import Home from './component/Home';


const router = createMemoryRouter([
  { path: '/', element: <Home /> },
]);

function App()
{
  return<RouterProvider router={router} />
}

export default App
