
import { Box } from '@mui/system';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Routes, Route } from 'react-router';

/* Theme based on https://material.io/tools/color/#!/
   ?view.left=0&view.right=0&primary.color=1B5E20&secondary.color=FDD835
*/
const customTheme = createTheme({
    palette: {
        primary: {
            light: '#4c8c4a',
            main: '#1b5e20',
            dark: '#003300',
            contrastText: '#fff',
        },
        secondary: {
            light: '#ffff6b',
            main: '#fdd835',
            dark: '#c6a700',
            contrastText: '#000',
        },
    },
});


interface AppProps {
    loggingOut: boolean;
    serverErrorOpen?: boolean;
    personalTitle?: string;
    tokenRefresh: boolean;
}



const App = (props: AppProps) => {
    if (!props.personalTitle) {
        return (
            <ThemeProvider theme={customTheme}>
                <CssBaseline />
                <Routes>
                    <Route path="/login" element={<LoginView />} />
                    <Route path="/oauth2cb" element={<OAuth2CallbackView />} />
                    <Route element={<LoginRedirect />} />
                </Routes>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider theme={customTheme}>
            <CssBaseline />
            <Box sx={{
                position: 'relative',
                width: '100%',
                minWidth: '768px',

            }}>
                <Box sx={{
                    flexGrow: 1,
                    backgroundColor: customTheme.palette.background.default,
                }}>
                    <OPNDrawer />
                    <main className={classes.main}>
                        <Routes>
                            <Route path="/login" component={LoginView} />
                            <Route path="/oauth2cb" component={Redirecting} />
                            <Route path="/settings" component={Settings} />
                            <Route path="/verify" component={Verify} />
                            <Route path="/period/:periodId([0-9]+)/:tab(t)/:transferId" component={PeriodTabs} />
                            <Route path="/period/:periodId([0-9]+)/:tab(statement)/:statementId" component={PeriodTabs} />
                            <Route path="/period/:periodId([0-9]+)/:tab(|reco|transactions|t|overview|statement|internal)"
                                component={PeriodTabs} />
                            <Route path="/period/:periodId([0-9]+)" component={PeriodTabs} />
                            <Route path="/file/:fileId([0-9]+)/:tab(|edit|designs|periods)" component={FileTabs} />
                            <Route path="/file/:fileId([0-9]+)" component={FileTabs} />
                            <Route path="/file/:tab(|list|archived)" component={FileListTabs} />
                            <Route path="/file" component={FileListTabs} />
                            <Route path="/" component={AuthenticatedHome} exact />
                            <Route component={NotFound} />
                        </Routes>
                    </main>
                </Box>
                <Linger enabled={tokenRefresh}>
                    <TokenRefreshDialog />
                </Linger>
                <Linger enabled={loggingOut}>
                    <LogoutDialog />
                </Linger>
                <Linger enabled={serverErrorOpen}>
                    <ServerErrorDialog />
                </Linger>
            </Box>
        </ThemeProvider>
    );
});


const mapStateToProps = (state) => {
    const {
        loggingOut,
        serverError,
        serverErrorOpen,
        tokenRefresh,
    } = state.app;
    const { personalProfile } = state.login;
    return {
        loggingOut: !!loggingOut,
        personalTitle: personalProfile ? personalProfile.title : null,
        serverError: serverError,
        serverErrorOpen: !!serverErrorOpen,
        tokenRefresh: !!tokenRefresh,
    };
};
