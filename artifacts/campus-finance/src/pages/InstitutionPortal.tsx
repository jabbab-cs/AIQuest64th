import { PublicTopBar } from "@/components/layout/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, UploadCloud, X, CheckCircle2, ArrowRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useCreateApplication, useRequestUploadUrl, useListApplications } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/ui/source-chip";
import { Link } from "wouter";

const institutionTypes = ["University", "School", "Hospital", "Hotel", "Factory", "Company", "Other"] as const;

export default function InstitutionPortal() {
  const referenceApplicationId = "reference-campus-energy-upgrade";
  const demoDescription = "Solar PV on roofs and car-park shades, LED lighting, a library retrofit and water-saving fixtures: JOD 553,000 in four upgrades.";
  const [university, setUniversity] = useState("");
  const [institutionType, setInstitutionType] = useState<(typeof institutionTypes)[number] | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<{file: File, id: string}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [submittedTitle, setSubmittedTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const createApplication = useCreateApplication();
  const requestUpload = useRequestUploadUrl();
  const { data: pastApplications = [], refetch } = useListApplications();

  // A demo submission starts as New while the bank performs its screening pass.
  // Poll only while that demo is in flight; ordinary uploads remain Pending.
  useEffect(() => {
    const demo = pastApplications.find(app => app.id !== referenceApplicationId && app.isReference && app.title === "Campus energy upgrade");
    if (!demo || String(demo.status) !== "New") return;
    const timer = window.setInterval(() => { refetch(); }, 1000);
    return () => window.clearInterval(timer);
  }, [pastApplications, refetch]);

  const loadDemoFiles = async () => {
    setIsLoadingDemo(true);
    try {
      const response = await fetch(`/api/applications/${referenceApplicationId}`);
      if (!response.ok) throw new Error("The synthetic reference case is unavailable.");
      const application = await response.json() as { files?: Array<{ id: string; name: string }> };
      if (!application.files || application.files.length !== 16) throw new Error("The synthetic reference case does not contain all 16 files.");
      const loaded = await Promise.all(application.files.map(async (entry) => {
        const fileResponse = await fetch(`/api/files/${encodeURIComponent(entry.id)}/original`);
        if (!fileResponse.ok) throw new Error(`Could not load ${entry.name}.`);
        const bytes = await fileResponse.blob();
        return { file: new File([bytes], entry.name, { type: "application/pdf" }), id: `${entry.name}-${Math.random().toString(36).slice(2)}` };
      }));
      setUniversity("Demo University (synthetic)");
      setInstitutionType("University");
      setTitle("Campus energy upgrade");
      setDescription(demoDescription);
      setFiles(loaded);
      toast({ title: "Demo files loaded", description: "16 synthetic PDFs are ready to submit." });
    } catch (error) {
      toast({ title: "Demo unavailable", description: error instanceof Error ? error.message : "Could not load the synthetic files.", variant: "destructive" });
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        id: Math.random().toString(36).substring(7)
      }));
      
      const validFiles = newFiles.filter(({file}) => {
        if (file.type !== "application/pdf") {
          toast({ title: "Invalid file type", description: `${file.name} is not a PDF.`, variant: "destructive" });
          return false;
        }
        if (file.size > 15 * 1024 * 1024) {
          toast({ title: "File too large", description: `${file.name} exceeds 15MB.`, variant: "destructive" });
          return false;
        }
        return true;
      });
      
      if (files.length + validFiles.length > 30) {
        toast({ title: "Too many files", description: "Maximum 30 files allowed.", variant: "destructive" });
        return;
      }
      
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!university || !title || !description || files.length === 0) {
      toast({ title: "Missing fields", description: "Please complete all fields and attach at least one PDF.", variant: "destructive" });
      return;
    }
    
    if (description.length < 15) {
      toast({ title: "Description too short", description: "Project description must be at least 15 characters long.", variant: "destructive" });
      return;
    }
    
    if (files.length === 0) {
      toast({ title: "No files", description: "You must attach at least one PDF file.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const uploadedFiles = [];
      
      for (const {file} of files) {
        // Get upload URL
        const { uploadURL, objectPath } = await requestUpload.mutateAsync({
          data: {
            name: file.name,
            size: file.size,
            contentType: file.type
          }
        });
        
        // Put bytes
        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type }
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload file ${file.name}`);
        }
        
        uploadedFiles.push({
          name: file.name,
          size: file.size,
          objectPath
        });
      }
      
      // Create application
      await createApplication.mutateAsync({
        data: {
          university,
          institutionType: institutionType || null,
          title,
          description,
          files: uploadedFiles
        }
      });
      
      setSubmittedTitle(title);
      setUniversity("");
      setInstitutionType("");
      setTitle("");
      setDescription("");
      setFiles([]);
      refetch();
      
       toast({
         title: "Sent to the bank for screening",
         description: "Your application is now in the bank workspace.",
       });
      
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "There was an error submitting your application.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicTopBar />
      
      <main className="flex-1 pb-20">
        {/* Hero Section */}
        <section className="border-b py-12 md:py-16">
          <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-6 md:grid-cols-[1.5fr_0.9fr]">
            <div className="max-w-[640px]">
              <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">INSTITUTION PORTAL</p>
              <h1 className="mb-5 font-serif text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-foreground md:text-[54px]">
                One application.<br/>Everything in its place.
              </h1>
              <p className="max-w-[590px] text-[16px] leading-[1.6] text-muted-foreground">
                Tell us what the project will do, then add the files behind it. You can submit what you have now; the bank can request missing evidence after screening.
              </p>
            </div>

            <div className="hidden md:block" aria-hidden="true">
              <div className="flex items-center gap-3 rounded-xl border bg-secondary/60 p-5">
                <div className="flex flex-1 flex-col gap-2">
                  {["PROJECT", "FORECAST", "APPROVALS"].map((label) => <div key={label} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground"><FileText className="h-3.5 w-3.5" />{label}</div>)}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="rounded-md bg-primary px-3 py-2 text-[11px] font-semibold tracking-[0.06em] text-primary-foreground">ONE FILE ✓</div>
              </div>
            </div>
          </div>
        </section>

        {/* Process Cards */}
        <section className="border-b">
          <div className="mx-auto max-w-[1200px] px-6">
            <ol className="grid md:grid-cols-3">
              {[
                ["01", "Describe the project", "What are you upgrading, and what will change?"],
                ["02", "Add the evidence", "Attach the proposal, forecast, cost study and any approvals you have."],
                ["03", "Send for screening", "The bank receives one application with every file in place."],
              ].map(([number, heading, text]) => (
                <li key={number} className="flex gap-4 border-b py-6 last:border-b-0 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0">
                  <span className="font-mono text-[13px] text-muted-foreground">{number}</span>
                  <div>
                    <h2 className="text-[15px] font-semibold text-foreground">{heading}</h2>
                    <p className="mt-1 text-[14px] leading-[1.5] text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Form and Submissions Grid */}
        <section className="mx-auto mt-10 max-w-[1200px] px-6">
          {submittedTitle && (
            <div className="mb-8 p-4 bg-success/30 border border-success text-success-foreground rounded-lg flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 mt-0.5" />
              <div>
                <h4 className="font-semibold">Application submitted</h4>
                <p className="text-sm mt-1">{submittedTitle} was submitted. It now appears in the bank's pending applications.</p>
              </div>
            </div>
          )}
          
          <div className="grid lg:grid-cols-[1.8fr_1fr] gap-8">
            {/* Form */}
            <div>
              <Card>
                <CardHeader>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">NEW APPLICATION</p>
                  <CardTitle className="font-serif text-[26px] font-semibold">Tell us about the project</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor="university" className="text-sm font-medium">Institution name</label>
                        <Input 
                          id="university"
                          value={university}
                          onChange={(e) => setUniversity(e.target.value)}
                          maxLength={120}
                          placeholder="e.g. Al-Rawda Private Hospital"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="institution-type" className="text-sm font-medium">Institution type <span className="font-normal text-muted-foreground">(optional)</span></label>
                        <select
                          id="institution-type"
                          value={institutionType}
                          onChange={(e) => setInstitutionType(e.target.value as typeof institutionType)}
                          className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-base transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 md:text-sm"
                        >
                          <option value="">Not specified</option>
                          {institutionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label htmlFor="title" className="text-sm font-medium">Project title</label>
                        <Input 
                          id="title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          maxLength={160}
                          placeholder="e.g. Rooftop solar and LED upgrade"
                        />
                      </div>
                      
                      <div className="space-y-2 md:col-span-2">
                        <label htmlFor="description" className="text-sm font-medium">Project description</label>
                        <Textarea 
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          maxLength={3000}
                          className="min-h-[120px]"
                          placeholder="Describe the scope, objectives, and current status of the project..."
                        />
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <h3 className="text-lg font-semibold mb-4">Add project files</h3>
                      
                      <div 
                        className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input bg-secondary/30 p-8 text-center transition-colors hover:border-primary/40 hover:bg-secondary/60"
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                        role="button"
                        tabIndex={0}
                        aria-label="Upload PDF project files"
                      >
                        <UploadCloud className="h-7 w-7 text-muted-foreground" />
                        <span className="mt-2 font-semibold text-foreground">Add project files</span>
                        <span className="text-sm text-muted-foreground">PDFs only · up to 30 files · 15 MB each</span>
                        <input 
                          type="file" 
                          multiple 
                          accept="application/pdf"
                          className="hidden" 
                          ref={fileInputRef}
                          onChange={handleFileChange}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-3">
                        <Button type="button" variant="outline" size="sm" className="min-h-11 sm:min-h-9" onClick={loadDemoFiles} disabled={isLoadingDemo || isSubmitting}>
                          {isLoadingDemo ? "Loading demo files…" : "Load demo files"}
                        </Button>
                        <span className="text-xs text-muted-foreground">16 synthetic PDFs for a live screening demo</span>
                      </div>
                      
                      {files.length > 0 && (
                        <div className="mt-6">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-medium">{files.length} files selected</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setFiles([])} className="text-destructive">
                              Clear all
                            </Button>
                          </div>
                          
                          <div className="grid gap-2 max-h-[240px] overflow-y-auto pr-2">
                             {files.map(({file, id}) => (
                              <div key={id} className="flex items-center justify-between p-2 rounded-md border bg-white">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                   <div className="min-w-0">
                                     <span className="block text-sm truncate" title={file.name}>{file.name}</span>
                                     {university === "Demo University (synthetic)" && <span className="block text-[11px] font-semibold tracking-[0.06em] text-brass">SYNTHETIC DEMO DOCUMENT</span>}
                                   </div>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                  <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeFile(id)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <Button type="submit" size="lg" className="w-full text-base h-12" disabled={isSubmitting}>
                      {isSubmitting ? "Submitting..." : "Submit application"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
            
            {/* Sidebar */}
            <div>
              <Card className="sticky top-[100px]">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.06em]">YOUR SUBMISSIONS</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y max-h-[500px] overflow-y-auto">
                     {pastApplications.filter(app => app.id !== referenceApplicationId).length === 0 ? (
                      <div className="p-9 text-center text-sm text-muted-foreground">
                        <FileText className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
                        <p className="font-semibold text-foreground">No applications yet</p>
                        <p className="mx-auto mt-2 max-w-[200px] text-[12px] leading-[1.45]">Your submitted projects will appear here with their current status.</p>
                      </div>
                    ) : (
                       pastApplications.filter(app => app.id !== referenceApplicationId).map(app => (
                        <div key={app.id} className="p-4 hover:bg-secondary/10 transition-colors">
                          <h4 className="font-semibold text-foreground mb-1 line-clamp-1" title={app.title}>{app.title}</h4>
                          <div className="text-sm text-muted-foreground mb-3">{app.university}{app.institutionType && ` · ${app.institutionType}`}</div>
                          <div className="flex items-center justify-between">
                            {app.status === "New" ? <Badge variant="warning">Screening…</Badge> : <StatusBadge status={app.status} />}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {app.files.length}
                            </span>
                          </div>
                          {/^(Approved|Verifying|Paid)$/.test(app.status) && <Link href="/institution/verification" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:min-h-0">Follow verification <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
