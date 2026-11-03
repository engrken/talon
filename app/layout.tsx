import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'Barangay Talon | Solar Energy Analytics', description:'Public off-grid USB charging energy dashboard for Barangay Talon' };
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
