import React, { useState, useEffect } from 'react';
import logo from './assets/Tuclas_Logo.png';
import { supabase } from './lib/supabase';
import LocationPickerMap from './components/LocationPickerMap';
import AuthModal from './components/AuthModal';
import { 
  TrendingUp, 
  Plus, 
  RefreshCw, 
  Edit2, 
  Trash2, 
  Star, 
  UploadCloud, 
  Image as ImageIcon,
  LogOut,
  Eye,
  EyeOff,
  Search,
  ShieldCheck,
  Hotel,
  UtensilsCrossed,
  Compass
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [activeTab, setActiveTab] = useState<'attractions' | 'hotels' | 'food' | 'fares'>('attractions');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Database Records State
  const [destinations, setDestinations] = useState<any[]>([]);
  const [fares, setFares] = useState<any[]>([]);

  // Editing State IDs
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editingFareId, setEditingFareId] = useState<string | number | null>(null);

  // Initial Form States
  const initialDestState = {
    name: '',
    category: 'attractions',
    barangay: 'Brgy. Poblacion',
    eco_fee: 50,
    travel_time: '15 mins from center',
    image_url: '',
    images: [] as string[],
    latitude: '',
    longitude: '',
    lgu_status: 'LGU Registered',
    description: '',
    visitor_advisory: '',
    is_popular: false,
    is_active: true,
  };

  const initialFareState = {
    mode: 'tricycle',
    title: '',
    route: '',
    duration: '15-20 mins',
    fare_min: 50,
    fare_max: 100,
  };

  const [newDest, setNewDest] = useState(initialDestState);
  const [newFare, setNewFare] = useState(initialFareState);

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchData();

    const destChannel = supabase
      .channel('realtime-destinations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'destinations' },
        () => fetchDestinations()
      )
      .subscribe();

    const faresChannel = supabase
      .channel('realtime-fares')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transport_fares' },
        () => fetchFares()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(destChannel);
      supabase.removeChannel(faresChannel);
    };
  }, [session]);

  async function fetchDestinations() {
    const { data: dests } = await supabase
      .from('destinations')
      .select('*')
      .order('created_at', { ascending: false });

    if (dests) setDestinations(dests);
  }

  async function fetchFares() {
    const { data: fareList } = await supabase
      .from('transport_fares')
      .select('*')
      .order('created_at', { ascending: false });

    if (fareList) setFares(fareList);
  }

  async function fetchData() {
    setLoading(true);
    await Promise.all([fetchDestinations(), fetchFares()]);
    setLoading(false);
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Image Upload Pipeline
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploadingImage(true);

      const files = Array.from(e.target.files);
      const uploadedUrls: string[] = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('destinations')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('destinations')
          .getPublicUrl(filePath);

        uploadedUrls.push(data.publicUrl);
      }

      setNewDest((prev) => {
        const updatedImages = [...(prev.images || []), ...uploadedUrls];
        return {
          ...prev,
          images: updatedImages,
          image_url: prev.image_url || updatedImages[0] || '',
        };
      });
    } catch (error: any) {
      alert('Failed to upload image: ' + error.message);
    } finally {
      setUploadingImage(false);
    }
  }

  function handleRemoveImage(indexToRemove: number) {
    setNewDest((prev) => {
      const filtered = (prev.images || []).filter((_, idx) => idx !== indexToRemove);
      return {
        ...prev,
        images: filtered,
        image_url: filtered[0] || '',
      };
    });
  }

  // Destination Handlers
  function handleStartEditDest(d: any) {
    setEditingId(d.id);
    const imgList = d.images && d.images.length > 0 ? d.images : d.image_url ? [d.image_url] : [];
    setNewDest({
      name: d.name || '',
      category: d.category || activeTab,
      barangay: d.barangay || 'Brgy. Poblacion',
      eco_fee: d.eco_fee ?? 50,
      travel_time: d.travel_time || '15 mins from center',
      image_url: d.image_url || imgList[0] || '',
      images: imgList,
      latitude: d.latitude ? String(d.latitude) : '',
      longitude: d.longitude ? String(d.longitude) : '',
      lgu_status: d.lgu_status || 'LGU Registered',
      description: d.description || '',
      visitor_advisory: d.visitor_advisory || '',
      is_popular: d.is_popular ?? false,
      is_active: d.is_active ?? true,
    });
    const formElement = document.getElementById('dest-form-card');
    if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  }

  function handleCancelEditDest() {
    setEditingId(null);
    setNewDest({ ...initialDestState, category: activeTab === 'fares' ? 'attractions' : activeTab });
  }

async function handleSaveDestination(e: React.FormEvent) {
  e.preventDefault();
  if (!newDest.name) return;

  // Determine correct category based on active tab
  const resolvedCategory =
    activeTab === 'hotels'
      ? 'accommodation'
      : activeTab === 'food'
      ? 'food'
      : activeTab === 'fares'
      ? newDest.category
      : newDest.category || 'attractions';

  const payload = {
    name: newDest.name,
    category: resolvedCategory,
    barangay: newDest.barangay,
    eco_fee: Number(newDest.eco_fee) || 0,
    travel_time: newDest.travel_time,
    image_url: newDest.image_url || (newDest.images && newDest.images[0]) || '',
    images: newDest.images,
    latitude: newDest.latitude ? parseFloat(String(newDest.latitude)) : null,
    longitude: newDest.longitude ? parseFloat(String(newDest.longitude)) : null,
    lgu_status: newDest.lgu_status || 'LGU Registered',
    description: newDest.description,
    visitor_advisory: newDest.visitor_advisory,
    is_popular: Boolean(newDest.is_popular),
    is_active: true,
  };

  if (editingId) {
    const { error } = await supabase
      .from('destinations')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', editingId);

    if (!error) {
      handleCancelEditDest();
      fetchData();
    } else {
      alert(error.message);
    }
  } else {
    const { error } = await supabase.from('destinations').insert([payload]);
    if (!error) {
      setNewDest({ ...initialDestState, category: resolvedCategory });
      fetchData();
    } else {
      alert(error.message);
    }
  }
}

  async function handleDeleteDestination(id: string | number) {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    const { error } = await supabase.from('destinations').delete().eq('id', id);
    if (!error) {
      fetchData();
    } else {
      alert(error.message);
    }
  }

  // Fare Handlers
  function handleStartEditFare(f: any) {
    setEditingFareId(f.id);
    setNewFare({
      mode: f.mode || 'tricycle',
      title: f.title || '',
      route: f.route || '',
      duration: f.duration || '15-20 mins',
      fare_min: f.fare_min ?? 50,
      fare_max: f.fare_max ?? 100,
    });
    const formElement = document.getElementById('fare-form-card');
    if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  }

  function handleCancelEditFare() {
    setEditingFareId(null);
    setNewFare(initialFareState);
  }

  async function handleSaveFare(e: React.FormEvent) {
    e.preventDefault();
    if (!newFare.title || !newFare.route) {
      alert('Please provide a Route Title and Route Path.');
      return;
    }

    const payload = {
      mode: newFare.mode,
      title: newFare.title,
      route: newFare.route,
      duration: newFare.duration,
      fare_min: Number(newFare.fare_min),
      fare_max: Number(newFare.fare_max),
    };

    if (editingFareId) {
      const { error } = await supabase
        .from('transport_fares')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingFareId);

      if (!error) {
        handleCancelEditFare();
        fetchFares();
      } else {
        alert(error.message);
      }
    } else {
      const { error } = await supabase.from('transport_fares').insert([payload]);
      if (!error) {
        setNewFare(initialFareState);
        fetchFares();
      } else {
        alert(error.message);
      }
    }
  }

  async function handleDeleteFare(id: string | number) {
    if (!window.confirm('Are you sure you want to delete this regulated fare entry?')) return;
    const { error } = await supabase.from('transport_fares').delete().eq('id', id);
    if (!error) {
      fetchFares();
    } else {
      alert(error.message);
    }
  }

// Flexible Category Matching Helper
  const isAttractionOrBeach = (cat: string) => {
    const c = (cat || '').toLowerCase();
    return (
      c.includes('beach') ||
      c.includes('cove') ||
      c.includes('lagoon') ||
      c.includes('island') ||
      c.includes('attraction') ||
      (!c.includes('hotel') && !c.includes('stay') && !c.includes('accommodation') && !c.includes('resort') && !c.includes('inn') && !c.includes('food') && !c.includes('dining') && !c.includes('restaurant') && !c.includes('cafe'))
    );
  };

  const isHotelOrStay = (cat: string) => {
    const c = (cat || '').toLowerCase();
    return c.includes('hotel') || c.includes('stay') || c.includes('accommodation') || c.includes('resort') || c.includes('inn') || c.includes('homestay');
  };

  const isFoodOrDining = (cat: string) => {
    const c = (cat || '').toLowerCase();
    return c.includes('food') || c.includes('dining') || c.includes('restaurant') || c.includes('grill') || c.includes('cafe') || c.includes('resto');
  };

  // Filtered records based on active tab category
  const displayedDestinations = destinations.filter((d) => {
    const cat = d.category || '';
    const matchesTab = 
      activeTab === 'attractions' ? isAttractionOrBeach(cat) :
      activeTab === 'hotels' ? isHotelOrStay(cat) :
      activeTab === 'food' ? isFoodOrDining(cat) : true;

    const matchesSearch =
      searchQuery.trim() === '' ||
      (d.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.barangay || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.category || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  const totalAttractions = destinations.filter(d => isAttractionOrBeach(d.category)).length;
  const totalHotels = destinations.filter(d => isHotelOrStay(d.category)).length;
  const totalFood = destinations.filter(d => isFoodOrDining(d.category)).length;
  const totalTariffs = fares.length;

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0284c7] to-[#0369a1] flex items-center justify-center p-4">
        <div className="bg-white px-8 py-6 rounded-3xl shadow-xl flex items-center gap-3 text-slate-700 text-sm font-semibold">
          <RefreshCw className="w-5 h-5 animate-spin text-[#0284c7]" />
          Authenticating TuClas Portal...
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthModal onSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0284c7] via-[#0369a1] to-[#0c4a6e] p-3 sm:p-6 lg:p-8 flex items-center justify-center font-sans antialiased text-slate-800">
      {/* Outer Canvas */}
      <div className="w-full max-w-[1580px] h-[94vh] min-h-[760px] bg-[#f0f9ff] rounded-[32px] shadow-2xl overflow-hidden flex border border-white/20">
        
        {/* Sidebar */}
        <aside className="w-64 bg-[#0369a1] text-white flex flex-col justify-between p-5 select-none relative">
          <div>
            {/* Top Logo */}
            <div className="flex items-center gap-3 px-2 py-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-md p-1 border border-white/40">
                <img 
                  src={logo} 
                  alt="TuClas Logo" 
                  className="w-full h-full object-contain" 
                />
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight leading-none text-white">TuClas</h1>
                <span className="text-[11px] font-semibold text-sky-200">LGU Tourism Admin</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1.5">
              <button
                onClick={() => { setActiveTab('attractions'); handleCancelEditDest(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all text-left ${
                  activeTab === 'attractions'
                    ? 'bg-white text-[#0284c7] shadow-md shadow-black/10'
                    : 'text-sky-100/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Compass className="w-4 h-4" />
                Attractions & Beaches
              </button>

              <button
                onClick={() => { setActiveTab('hotels'); handleCancelEditDest(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all text-left ${
                  activeTab === 'hotels'
                    ? 'bg-white text-[#0284c7] shadow-md shadow-black/10'
                    : 'text-sky-100/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Hotel className="w-4 h-4" />
                Hotels & Stays
              </button>

              <button
                onClick={() => { setActiveTab('food'); handleCancelEditDest(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all text-left ${
                  activeTab === 'food'
                    ? 'bg-white text-[#0284c7] shadow-md shadow-black/10'
                    : 'text-sky-100/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4" />
                Food & Dining
              </button>

              <button
                onClick={() => { setActiveTab('fares'); handleCancelEditFare(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all text-left ${
                  activeTab === 'fares'
                    ? 'bg-white text-[#0284c7] shadow-md shadow-black/10'
                    : 'text-sky-100/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Regulated Tariffs
              </button>
            </nav>
          </div>

          {/* User Session Footer */}
          <div className="pt-4 border-t border-white/15 space-y-3">
            <div className="px-2">
              <span className="text-[10px] text-sky-200/70 font-semibold block uppercase tracking-wider">Officer Session</span>
              <span className="text-xs font-bold text-white truncate block mt-0.5">{session.user.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-200 bg-white/10 hover:bg-white/20 rounded-xl transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log Out
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden">
          
          {/* Top Navbar */}
          <header className="h-18 px-8 border-b border-sky-100 bg-white/90 backdrop-blur-sm flex items-center justify-between gap-4">
            <div className="relative w-80">
              <Search className="w-4 h-4 text-sky-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search registry, barangay, spot..."
                className="w-full pl-9 pr-4 py-2 bg-[#f0f9ff] border border-sky-200 rounded-full text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#0284c7] transition"
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={fetchData}
                className="p-2 rounded-full border border-sky-200 hover:bg-sky-50 text-[#0284c7] transition"
                title="Sync live records"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <div className="h-6 w-px bg-sky-200" />

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-white border border-sky-200 p-1 flex items-center justify-center shadow-sm">
                  <img 
                    src={logo} 
                    alt="Officer Badge Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-extrabold text-slate-800">Tourism Officer</div>
                  <div className="text-[10px] text-sky-600 font-semibold">Municipality of Calatrava</div>
                </div>
              </div>
            </div>
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
            
            {/* Banner */}
            <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-sky-100 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-[#0284c7] text-[11px] font-bold border border-sky-200/60">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Official Tourism Management System
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {activeTab === 'attractions' && 'Attractions & Beaches Management'}
                  {activeTab === 'hotels' && 'Hotels & Accommodation Stays'}
                  {activeTab === 'food' && 'Food & Dining Establishments'}
                  {activeTab === 'fares' && 'Regulated Transport Tariff Matrix'}
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Manage municipal registries, interactive map pins, and verified tourism locations in Calatrava.
                </p>
              </div>

              {/* Status Badges */}
              <div className="flex gap-3">
                <div className="bg-[#f0f9ff] border border-sky-200/80 rounded-2xl px-4 py-3 text-center min-w-[90px]">
                  <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">Attractions</span>
                  <span className="text-xl font-extrabold text-[#0284c7] mt-0.5 block">{totalAttractions}</span>
                </div>
                <div className="bg-[#f0f9ff] border border-sky-200/80 rounded-2xl px-4 py-3 text-center min-w-[90px]">
                  <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">Hotels</span>
                  <span className="text-xl font-extrabold text-indigo-600 mt-0.5 block">{totalHotels}</span>
                </div>
                <div className="bg-[#f0f9ff] border border-sky-200/80 rounded-2xl px-4 py-3 text-center min-w-[90px]">
                  <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">Food Spots</span>
                  <span className="text-xl font-extrabold text-orange-600 mt-0.5 block">{totalFood}</span>
                </div>
                <div className="bg-[#f0f9ff] border border-sky-200/80 rounded-2xl px-4 py-3 text-center min-w-[90px]">
                  <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">Tariffs</span>
                  <span className="text-xl font-extrabold text-amber-600 mt-0.5 block">{totalTariffs}</span>
                </div>
              </div>
            </div>

            {/* TAB 1, 2, 3: Destinations (Attractions, Hotels, Food) */}
            {activeTab !== 'fares' && (
              <div className="space-y-6">
                
                {/* Form Card */}
                <div id="dest-form-card" className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-sky-100">
                  <div className="flex justify-between items-center pb-5 border-b border-slate-100 mb-6">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        {editingId ? (
                          <>
                            <Edit2 className="w-4 h-4 text-[#0284c7]" />
                            Edit Record Details
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 text-[#0284c7]" />
                            Add New {activeTab === 'hotels' ? 'Hotel / Stay' : activeTab === 'food' ? 'Food / Dining Spot' : 'Attraction / Beach'}
                          </>
                        )}
                      </h3>
                      <span className="text-xs text-slate-400">Fill in details and pin coordinates for mobile map integration.</span>
                    </div>

                    {editingId && (
                      <button
                        type="button"
                        onClick={handleCancelEditDest}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSaveDestination} className="space-y-5">
                    {/* Toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#f0f9ff] border border-sky-200 rounded-2xl p-4">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newDest.is_popular}
                            onChange={(e) => setNewDest({ ...newDest, is_popular: e.target.checked })}
                            className="w-4 h-4 text-[#0284c7] rounded focus:ring-[#0284c7] cursor-pointer"
                          />
                          <div>
                            <strong className="text-xs font-extrabold text-slate-800 block">Featured Carousel Placement</strong>
                            <span className="text-[11px] text-slate-500">Highlight this spot on the home screen carousel.</span>
                          </div>
                        </label>
                      </div>

                      <div className="bg-[#f0f9ff] border border-sky-200 rounded-2xl p-4">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newDest.is_active}
                            onChange={(e) => setNewDest({ ...newDest, is_active: e.target.checked })}
                            className="w-4 h-4 text-[#0284c7] rounded focus:ring-[#0284c7] cursor-pointer"
                          />
                          <div>
                            <strong className="text-xs font-extrabold text-slate-800 block">Active Map Visibility</strong>
                            <span className="text-[11px] text-slate-500">Render this pin and details inside the mobile map tab.</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Row 1: Name & Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Establishment / Spot Name *</label>
                        <input
                          placeholder="e.g., Calatrava Seaside Hotel or Bay Grill"
                          value={newDest.name}
                          onChange={(e) => setNewDest({ ...newDest, name: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Category Type *</label>
                        <select
                          value={activeTab === 'hotels' ? 'accommodation' : activeTab === 'food' ? 'food' : newDest.category}
                          onChange={(e) => setNewDest({ ...newDest, category: e.target.value })}
                          disabled={activeTab !== 'attractions'}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition disabled:opacity-70"
                        >
                          <option value="attractions">Attractions & Landmarks</option>
                          <option value="beaches">Beaches & Coves</option>
                          <option value="accommodation">Hotels & Stays (Accommodation)</option>
                          <option value="food">Food & Dining</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Barangay & Fee / Price Range Note */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Barangay / Location</label>
                        <input
                          placeholder="e.g., Brgy. Poblacion"
                          value={newDest.barangay}
                          onChange={(e) => setNewDest({ ...newDest, barangay: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Eco Fee / Starting Price (PHP)</label>
                        <input
                          type="number"
                          placeholder="50"
                          value={newDest.eco_fee}
                          onChange={(e) => setNewDest({ ...newDest, eco_fee: Number(e.target.value) })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                        />
                      </div>
                    </div>

                    {/* Row 3: Travel Time & Status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Proximity / Access Note</label>
                        <input
                          placeholder="e.g., Near municipal port / 5 mins walk"
                          value={newDest.travel_time}
                          onChange={(e) => setNewDest({ ...newDest, travel_time: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">LGU Status Tag</label>
                        <input
                          placeholder="e.g., LGU Accredited"
                          value={newDest.lgu_status}
                          onChange={(e) => setNewDest({ ...newDest, lgu_status: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                        />
                      </div>
                    </div>

                    {/* Row 4: Map Pin Picker */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          Map Coordinates (Click on map to set GPS location)
                        </label>
                        {newDest.latitude && newDest.longitude ? (
                          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            Lat: {newDest.latitude} | Long: {newDest.longitude}
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-medium">No coordinate pin selected</span>
                        )}
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-slate-200">
                        <LocationPickerMap
                          latitude={newDest.latitude ? parseFloat(String(newDest.latitude)) : null}
                          longitude={newDest.longitude ? parseFloat(String(newDest.longitude)) : null}
                          onChange={async (lat, lng) => {
                            setNewDest((prev) => ({
                              ...prev,
                              latitude: String(lat),
                              longitude: String(lng),
                            }));

                            try {
                              const res = await fetch(
                                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
                              );
                              const data = await res.json();
                              const villageOrBrgy =
                                data.address?.village ||
                                data.address?.suburb ||
                                data.address?.hamlet ||
                                data.address?.quarter ||
                                data.address?.municipality ||
                                '';

                              if (villageOrBrgy) {
                                setNewDest((prev) => ({
                                  ...prev,
                                  barangay: villageOrBrgy.startsWith('Brgy') ? villageOrBrgy : `Brgy. ${villageOrBrgy}`,
                                }));
                              }
                            } catch {
                              // Keep existing barangay
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Row 5: Photos */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Establishment Photos</label>
                      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-sky-200 hover:border-[#0284c7] rounded-2xl p-4 cursor-pointer bg-[#f0f9ff]/50 hover:bg-[#f0f9ff] transition text-slate-600 text-xs font-bold">
                        <UploadCloud className="w-4 h-4 text-[#0284c7]" />
                        <span>{uploadingImage ? 'Uploading photos...' : 'Click to select and upload photos'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                      </label>

                      {newDest.images && newDest.images.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2.5">
                          {newDest.images.map((url, idx) => (
                            <div key={idx} className="relative group w-20 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                              <img src={url} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(idx)}
                                className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-90 hover:opacity-100"
                              >
                                X
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                          <ImageIcon className="w-3.5 h-3.5" /> No photo uploaded yet
                        </div>
                      )}
                    </div>

                    {/* Row 6: Description */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Overview & Amenities / Menu Highlights</label>
                      <textarea
                        rows={3}
                        placeholder={
                          activeTab === 'hotels' ? 'Rooms, rates, AC availability, contact info...' :
                          activeTab === 'food' ? 'Specialties, fresh seafood, local Romblomanon dishes...' :
                          'Overview, views, activities...'
                        }
                        value={newDest.description}
                        onChange={(e) => setNewDest({ ...newDest, description: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                      />
                    </div>

                    {/* Row 7: Advisory */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Advisory & Guidelines</label>
                      <textarea
                        rows={2}
                        placeholder="Reservation guidelines, operating hours, safety notices..."
                        value={newDest.visitor_advisory}
                        onChange={(e) => setNewDest({ ...newDest, visitor_advisory: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={uploadingImage}
                      className="w-full py-3.5 bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold rounded-2xl transition shadow-md shadow-[#0284c7]/25 disabled:bg-slate-300 text-xs tracking-wide"
                    >
                      {editingId ? 'Update Record' : 'Save and Publish to Mobile App'}
                    </button>
                  </form>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-3xl border border-sky-100 overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        {activeTab === 'attractions' && 'Registered Attractions & Beaches'}
                        {activeTab === 'hotels' && 'Registered Hotels & Stays'}
                        {activeTab === 'food' && 'Registered Food & Dining'}
                      </h4>
                      <span className="text-xs text-slate-400">Total of {displayedDestinations.length} records</span>
                    </div>
                  </div>

                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-[#f8fafc] text-slate-700 font-extrabold border-b border-slate-200/80">
                      <tr>
                        <th className="p-4">Establishment Name</th>
                        <th className="p-4">Location</th>
                        <th className="p-4">Coordinates</th>
                        <th className="p-4">Visibility</th>
                        <th className="p-4">Fee / Rate</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedDestinations.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                            No records registered in this category yet.
                          </td>
                        </tr>
                      ) : (
                        displayedDestinations.map((d) => (
                          <tr key={d.id} className="hover:bg-sky-50/40 transition">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {(d.images?.[0] || d.image_url) ? (
                                  <img
                                    src={d.images?.[0] || d.image_url}
                                    alt={d.name}
                                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                    <ImageIcon className="w-4 h-4" />
                                  </div>
                                )}
                                <div>
                                  <span className="font-extrabold text-slate-900 block text-xs">{d.name}</span>
                                  <span className="text-[10px] font-bold text-[#0284c7] uppercase tracking-wider">
                                    {d.category || activeTab}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-medium text-slate-700">{d.barangay}</td>
                            <td className="p-4">
                              {d.latitude && d.longitude ? (
                                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                                  {Number(d.latitude).toFixed(4)}, {Number(d.longitude).toFixed(4)}
                                </span>
                              ) : (
                                <span className="text-[11px] font-rose-500 font-medium">Unpinned</span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1 items-start">
                                {d.is_active !== false ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                    <Eye className="w-3 h-3" /> Live
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                    <EyeOff className="w-3 h-3" /> Hidden
                                  </span>
                                )}
                                {d.is_popular && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                    <Star className="w-3 h-3 fill-amber-500" /> Featured
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 font-bold text-slate-900">PHP {d.eco_fee || 0}</td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleStartEditDest(d)}
                                  className="p-2 text-[#0284c7] hover:bg-sky-50 rounded-xl transition"
                                  title="Edit Record"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDestination(d.id)}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: Tariffs Workflow */}
            {activeTab === 'fares' && (
              <div className="space-y-6">
                
                {/* Form */}
                <div id="fare-form-card" className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-sky-100">
                  <div className="flex justify-between items-center pb-5 border-b border-slate-100 mb-6">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        {editingFareId ? (
                          <>
                            <Edit2 className="w-4 h-4 text-[#0284c7]" />
                            Edit Regulated Tariff Entry
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 text-[#0284c7]" />
                            Add Regulated Transport Route
                          </>
                        )}
                      </h3>
                      <span className="text-xs text-slate-400">Set standardized tariffs approved by the Sangguniang Bayan.</span>
                    </div>

                    {editingFareId && (
                      <button
                        type="button"
                        onClick={handleCancelEditFare}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSaveFare} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Vehicle / Transport Mode *</label>
                        <select
                          value={newFare.mode}
                          onChange={(e) => setNewFare({ ...newFare, mode: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                        >
                          <option value="tricycle">Tricycle (TODA)</option>
                          <option value="boat">Motorized Boat / Banca</option>
                          <option value="van">Public Van / Shuttle</option>
                          <option value="habal-habal">Habal-Habal Motorcycle</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Route Title *</label>
                        <input
                          placeholder="e.g., Poblacion to Lapus-Lapus"
                          value={newFare.title}
                          onChange={(e) => setNewFare({ ...newFare, title: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Estimated Duration</label>
                        <input
                          placeholder="e.g., 15-20 mins"
                          value={newFare.duration}
                          onChange={(e) => setNewFare({ ...newFare, duration: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Waypoints / Path Details *</label>
                        <input
                          placeholder="e.g., Calatrava Port to Barangay Talisay"
                          value={newFare.route}
                          onChange={(e) => setNewFare({ ...newFare, route: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Minimum Fare (PHP) *</label>
                        <input
                          type="number"
                          placeholder="50"
                          value={newFare.fare_min}
                          onChange={(e) => setNewFare({ ...newFare, fare_min: Number(e.target.value) })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Maximum Fare (PHP) *</label>
                        <input
                          type="number"
                          placeholder="100"
                          value={newFare.fare_max}
                          onChange={(e) => setNewFare({ ...newFare, fare_max: Number(e.target.value) })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#0284c7] transition"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold rounded-2xl transition shadow-md shadow-[#0284c7]/25 text-xs tracking-wide"
                    >
                      {editingFareId ? 'Update Regulated Tariff' : 'Publish Regulated Tariff'}
                    </button>
                  </form>
                </div>

                {/* Table */}
                <div className="bg-white rounded-3xl border border-sky-100 overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">Approved Transportation Rates</h4>
                      <span className="text-xs text-slate-400">Total of {fares.length} registered routes</span>
                    </div>
                  </div>

                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-[#f8fafc] text-slate-700 font-extrabold border-b border-slate-200/80">
                      <tr>
                        <th className="p-4">Transport Mode</th>
                        <th className="p-4">Route Title & Waypoints</th>
                        <th className="p-4">Est. Duration</th>
                        <th className="p-4">Approved Range</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fares.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                            No regulated fare routes published yet.
                          </td>
                        </tr>
                      ) : (
                        fares.map((f) => (
                          <tr key={f.id} className="hover:bg-sky-50/40 transition">
                            <td className="p-4">
                              <span className="text-[10px] px-2.5 py-1 bg-sky-50 text-[#0284c7] font-bold rounded-lg capitalize">
                                {f.mode}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="font-extrabold text-slate-900 block text-xs">{f.title}</span>
                              <span className="text-[11px] text-slate-400">{f.route}</span>
                            </td>
                            <td className="p-4 font-medium text-slate-700">{f.duration || 'Standard'}</td>
                            <td className="p-4 font-extrabold text-slate-900">
                              PHP {f.fare_min} - {f.fare_max}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleStartEditFare(f)}
                                  className="p-2 text-[#0284c7] hover:bg-sky-50 rounded-xl transition"
                                  title="Edit Rate"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteFare(f.id)}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition"
                                  title="Delete Rate"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}