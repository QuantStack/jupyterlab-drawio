@echo on
:: this is a nasty hack, and should not be needed, but the env isn't _quite_ right
call conda info
call deactivate
call C:\Miniconda\envs\jupyterlab-drawio\Scripts\activate.bat
call conda info
call python -m doit %%*
call python -m doit %%* || goto :error

goto :EOF

:error
echo Failed with error #%errorlevel%.
exit 1
