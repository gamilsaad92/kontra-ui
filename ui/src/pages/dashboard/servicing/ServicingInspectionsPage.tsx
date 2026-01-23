import Inspections from "../../../routes/Inspections";
import ServicingPhotoValidationPanel from "./ServicingPhotoValidationPanel";

export default function ServicingInspectionsPage() {
   return (
    <div className="space-y-6">
      <Inspections />
      <ServicingPhotoValidationPanel context="Inspections" />
    </div>
  );
}
