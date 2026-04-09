/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  LayoutDashboard, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Sprout, 
  CheckCircle2, 
  LogOut,
  Trash2,
  BarChart3,
  Calendar,
  Package
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { format } from 'date-fns';

import { db, auth } from './firebase';
import { CropRecord, CropStatus, OperationType, FirestoreErrorInfo } from './types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Error handling helper
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app, we might show a toast here
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [crops, setCrops] = useState<CropRecord[]>([]);
  const [isAddingCrop, setIsAddingCrop] = useState(false);

  // Form state
  const [newCrop, setNewCrop] = useState({
    name: '',
    quantity: '',
    plantingDate: format(new Date(), 'yyyy-MM-dd'),
    investmentAmount: '',
  });

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Data listener
  useEffect(() => {
    if (!isAuthReady || !user) {
      setCrops([]);
      return;
    }

    const path = 'crops';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CropRecord[];
      setCrops(records);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleAddCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const path = 'crops';
    try {
      await addDoc(collection(db, path), {
        userId: user.uid,
        name: newCrop.name,
        quantity: Number(newCrop.quantity),
        plantingDate: new Date(newCrop.plantingDate).toISOString(),
        investmentAmount: Number(newCrop.investmentAmount),
        status: 'planted',
        createdAt: serverTimestamp(),
      });
      setIsAddingCrop(false);
      setNewCrop({
        name: '',
        quantity: '',
        plantingDate: format(new Date(), 'yyyy-MM-dd'),
        investmentAmount: '',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateStatus = async (id: string, status: CropStatus, extraData: any = {}) => {
    const path = `crops/${id}`;
    try {
      await updateDoc(doc(db, 'crops', id), {
        status,
        ...extraData
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteRecord = async (id: string) => {
    const path = `crops/${id}`;
    try {
      await deleteDoc(doc(db, 'crops', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // Stats calculations
  const stats = useMemo(() => {
    const totalInvestment = crops.reduce((sum, c) => sum + c.investmentAmount, 0);
    const totalSales = crops.reduce((sum, c) => sum + (c.saleAmount || 0), 0);
    const totalProfit = totalSales - totalInvestment;
    
    const chartData = crops
      .filter(c => c.status === 'sold')
      .reduce((acc: any[], crop) => {
        const profit = (crop.saleAmount || 0) - crop.investmentAmount;
        const existing = acc.find(a => a.name === crop.name);
        if (existing) {
          existing.profit += profit;
        } else {
          acc.push({ name: crop.name, profit });
        }
        return acc;
      }, []);

    return { totalInvestment, totalSales, totalProfit, chartData };
  }, [crops]);

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Sprout className="w-12 h-12 text-green-600" />
          <p className="text-slate-500 font-medium">Loading CropMaster...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <Card className="w-full max-w-md border-none shadow-xl bg-white">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-green-100 p-3 rounded-2xl w-fit">
              <Sprout className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">CropMaster</CardTitle>
            <CardDescription className="text-slate-500">
              Your digital farm management assistant. Track crops, investments, and profits with ease.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <Button 
              onClick={handleLogin} 
              className="w-full h-12 text-lg font-medium bg-green-600 hover:bg-green-700 transition-all shadow-lg shadow-green-200"
            >
              Sign in with Google
            </Button>
            <p className="text-xs text-center text-slate-400">
              Securely manage your farm data in the cloud.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-bottom border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-green-600 p-1.5 rounded-lg">
            <Sprout className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">CropMaster</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium">{user.displayName}</span>
            <span className="text-xs text-slate-500">{user.email}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-500 hover:text-red-600">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-md bg-white overflow-hidden group">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total Investment</p>
                <h3 className="text-2xl font-bold">${stats.totalInvestment.toLocaleString()}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md bg-white overflow-hidden group">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="bg-green-50 p-3 rounded-xl text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total Sales</p>
                <h3 className="text-2xl font-bold">${stats.totalSales.toLocaleString()}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md bg-white overflow-hidden group">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="bg-purple-50 p-3 rounded-xl text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                {stats.totalProfit >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Net Profit</p>
                <h3 className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${stats.totalProfit.toLocaleString()}
                </h3>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="records" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <TabsList className="bg-white border border-slate-200 p-1">
              <TabsTrigger value="records" className="data-[state=active]:bg-slate-100">
                <Package className="w-4 h-4 mr-2" /> Records
              </TabsTrigger>
              <TabsTrigger value="stats" className="data-[state=active]:bg-slate-100">
                <BarChart3 className="w-4 h-4 mr-2" /> Statistics
              </TabsTrigger>
            </TabsList>

            <Dialog open={isAddingCrop} onOpenChange={setIsAddingCrop}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100">
                  <Plus className="w-4 h-4 mr-2" /> New Crop Record
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Crop Record</DialogTitle>
                  <DialogDescription>
                    Record a new planting session. You can update harvest and sales later.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddCrop} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Crop Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. Maize, Tomatoes" 
                      value={newCrop.name}
                      onChange={e => setNewCrop({...newCrop, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity (Units)</Label>
                      <Input 
                        id="quantity" 
                        type="number" 
                        placeholder="0" 
                        value={newCrop.quantity}
                        onChange={e => setNewCrop({...newCrop, quantity: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investment">Investment ($)</Label>
                      <Input 
                        id="investment" 
                        type="number" 
                        placeholder="0.00" 
                        value={newCrop.investmentAmount}
                        onChange={e => setNewCrop({...newCrop, investmentAmount: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Planting Date</Label>
                    <Input 
                      id="date" 
                      type="date" 
                      value={newCrop.plantingDate}
                      onChange={e => setNewCrop({...newCrop, plantingDate: e.target.value})}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">Save Record</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <TabsContent value="records" className="space-y-4">
            <Card className="border-none shadow-md bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Crop</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Planting Date</TableHead>
                    <TableHead>Investment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crops.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                        No records found. Start by adding your first crop!
                      </TableCell>
                    </TableRow>
                  ) : (
                    crops.map((crop) => (
                      <TableRow key={crop.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-medium">{crop.name}</TableCell>
                        <TableCell>{crop.quantity}</TableCell>
                        <TableCell className="text-slate-500">
                          {format(new Date(crop.plantingDate), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>${crop.investmentAmount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary" 
                            className={
                              crop.status === 'planted' ? 'bg-blue-100 text-blue-700' :
                              crop.status === 'harvested' ? 'bg-orange-100 text-orange-700' :
                              'bg-green-100 text-green-700'
                            }
                          >
                            {crop.status.charAt(0).toUpperCase() + crop.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {crop.status === 'planted' && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 border-orange-200 text-orange-600 hover:bg-orange-50"
                                onClick={() => updateStatus(crop.id, 'harvested', { harvestDate: new Date().toISOString() })}
                              >
                                Mark Harvested
                              </Button>
                            )}
                            {crop.status === 'harvested' && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="h-8 border-green-200 text-green-600 hover:bg-green-50">
                                    Record Sale
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                  <DialogHeader>
                                    <DialogTitle>Record Sale for {crop.name}</DialogTitle>
                                    <DialogDescription>
                                      Enter the final amount received from the sale.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="saleAmount">Sale Amount ($)</Label>
                                      <Input id="saleAmount" type="number" placeholder="0.00" autoFocus />
                                    </div>
                                    <Button 
                                      className="w-full bg-green-600 hover:bg-green-700"
                                      onClick={(e) => {
                                        const input = (e.currentTarget.parentElement?.querySelector('#saleAmount') as HTMLInputElement);
                                        if (input.value) {
                                          updateStatus(crop.id, 'sold', { saleAmount: Number(input.value) });
                                        }
                                      }}
                                    >
                                      Complete Sale
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 text-slate-400 hover:text-red-600"
                              onClick={() => deleteRecord(crop.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-none shadow-md bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">Profit by Crop Type</CardTitle>
                  <CardDescription>Cumulative profit for each crop species sold.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {stats.chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip 
                          cursor={{fill: '#f8fafc'}}
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        />
                        <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                          {stats.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#16a34a' : '#dc2626'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      No sales data available for charts.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-md bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                  <CardDescription>Latest updates to your farm records.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {crops.slice(0, 5).map((crop) => (
                      <div key={crop.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className={`p-2 rounded-lg ${
                          crop.status === 'planted' ? 'bg-blue-50 text-blue-600' :
                          crop.status === 'harvested' ? 'bg-orange-50 text-orange-600' :
                          'bg-green-50 text-green-600'
                        }`}>
                          {crop.status === 'planted' ? <Sprout className="w-4 h-4" /> :
                           crop.status === 'harvested' ? <Calendar className="w-4 h-4" /> :
                           <CheckCircle2 className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {crop.name} <span className="text-slate-500 font-normal">was marked as</span> {crop.status}
                          </p>
                          <p className="text-xs text-slate-400">
                            {crop.createdAt?.toDate ? format(crop.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                          </p>
                        </div>
                      </div>
                    ))}
                    {crops.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-8">No recent activity.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
