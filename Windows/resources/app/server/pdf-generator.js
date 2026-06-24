// PDF Generation Helper
// The application utilizes Electron's high-fidelity printToPDF from the rendered HTML view
// to ensure perfect Cairo Arabic fonts, HSL colors, and exact RTL layouts.
// This file acts as a metadata schema formatter for prescriptions.

function formatPrescriptionData(visit, settings) {
  return {
    doctorName: settings.doctorName || '',
    professionalTitle: settings.doctorTitle || '',
    specialty: settings.doctorSpecialty || '',
    workplace: settings.doctorWorkplace || '',
    logo: settings.clinicLogo || null,
    patientName: visit.patient_name || '',
    patientAge: visit.patient_age || '',
    visitDate: new Date(visit.created_at).toLocaleDateString('ar-EG'),
    medications: visit.prescription_json || [],
    notes: visit.examination_notes || '',
    address: settings.clinicAddress || '',
    phones: settings.clinicPhones || ''
  };
}

module.exports = {
  formatPrescriptionData
};
