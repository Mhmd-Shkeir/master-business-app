-- Preserve project supplier assignments under concurrent deletes.
ALTER TABLE "Project" DROP CONSTRAINT "Project_supplierId_fkey";
ALTER TABLE "Project" ADD CONSTRAINT "Project_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
