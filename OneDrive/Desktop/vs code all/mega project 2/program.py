import pyautogui
import time
import pyperclip
#Step 1:click on chrome icon to get ist cordinates (1196,1048)
pyautogui.click(1293,1051)
time.sleep(1)#wait for 1 second to ensure the click is regidtered
#Step 2:Drag the mouse from 553 138 to 1304  906 to select the text
pyautogui.moveTo(553,138)       
pyautogui.drag(1304,906,duration=2.0,buttom='left')
#step 3:Copy the selected text to the clipboard
pyautogui.hotkey('ctrl','c')
time.sleep(1)#wait for 1 second to ensure the copy is regidtered    
#Step 4:Retrieve the text from the clipboard and store it in a variable
text=pyperclip.paste()    
# print the copied text to verify  
print(text)
tct
#note:- that the text need to drag downward