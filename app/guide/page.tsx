import type {Metadata} from 'next';
import Guide from '@/components/Guide';
export const metadata:Metadata={title:'Help & Troubleshooting | Barangay Talon Solar Station',description:'Operator setup, ESP32 sensor calibration, diagnostics, safety procedures and troubleshooting guide for the Barangay Talon charging station.'};
export default function GuidePage(){return <Guide/>}
