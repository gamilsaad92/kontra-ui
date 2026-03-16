import DrawsDashboard from "../../../components/DrawsDashboard";
import ServicingPhotoValidationPanel from "./ServicingPhotoValidationPanel";

export default function ServicingDrawsPage() {
   return (
    <div className="space-y-6">
      <DrawsDashboard />
      <ServicingPhotoValidationPanel context="Draws" />
    </div>
  );
}
