import React from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Toolbar, AppBar, Typography, Box } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptIcon from '@mui/icons-material/Receipt';
import EventNoteIcon from '@mui/icons-material/EventNote';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import BuildIcon from '@mui/icons-material/Build';
import MessageIcon from '@mui/icons-material/Message';

const menuOptions = [
  { text: 'Dashboard', icon: <DashboardIcon /> },
  { text: 'Residentes', icon: <PeopleIcon /> },
  { text: 'Facturas', icon: <ReceiptIcon /> },
  { text: 'Reservas', icon: <EventNoteIcon /> },
  { text: 'Visitantes', icon: <SupervisorAccountIcon /> },
  { text: 'Mantenimiento', icon: <BuildIcon /> },
  { text: 'Comunicados', icon: <MessageIcon /> },
];

export default function MainLayout({ children }) {
  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: 1300 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Conjunto Residencial Los Pinos
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: 220,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: 220, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <List>
          {menuOptions.map((item, idx) => (
            <ListItem button key={item.text}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, bgcolor: '#f9fafc', p: 3, minHeight: '100vh' }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
